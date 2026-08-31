"""
NER Landslide Risk Prediction Microservice (SIH26002)
-----------------------------------------------------
FastAPI service exposing POST /predict. Combines a physically-motivated
monsoon-landslide heuristic with a lightweight scikit-learn logistic model
trained on synthetically-generated samples at startup. The heuristic guarantees
sensible behaviour even before/without training; the ML model smooths the
decision boundary.

Inputs : latitude, longitude, rainfall_mm, soil_moisture (0-1), slope (deg)
Outputs: risk_score (0.0-1.0), recommended_action, plus a factor breakdown.
"""
from __future__ import annotations

import math
import os
from typing import Literal, Optional

import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel, Field
from sklearn.linear_model import LogisticRegression

try:  # joblib is only needed to load a pre-trained model.pkl
    import joblib
except Exception:  # pragma: no cover
    joblib = None

# ---------------------------------------------------------------------------
# Optional pre-trained model, produced by train.py on REAL data (NASA Global
# Landslide Catalog + Open-Meteo terrain/weather). If model/model.pkl exists it
# is used; otherwise we fall back to the in-process synthetic model below so the
# service always works. Retrain with:  python train.py --samples 300
# ---------------------------------------------------------------------------
_MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model", "model.pkl")
_TRAINED = None
if joblib is not None and os.path.exists(_MODEL_PATH):
    try:
        _TRAINED = joblib.load(_MODEL_PATH)
        print(f"[ai-service] loaded trained model: {_TRAINED.get('model_type')} "
              f"({_TRAINED.get('data_source', 'unknown source')})")
    except Exception as exc:  # pragma: no cover
        print(f"[ai-service] could not load model.pkl ({exc}); using synthetic model")
        _TRAINED = None


def _load_bundle(name: str):
    """Load an optional model bundle (flood/congestion) trained on real data."""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model", name)
    if joblib is None or not os.path.exists(path):
        return None
    try:
        b = joblib.load(path)
        print(f"[ai-service] loaded {name}: {b.get('model_type')} ({b.get('data_source', '')})")
        return b
    except Exception as exc:  # pragma: no cover
        print(f"[ai-service] could not load {name} ({exc}); using heuristic fallback")
        return None


_FLOOD = _load_bundle("flood_model.pkl")
_CONGESTION = _load_bundle("congestion_model.pkl")


def _bundle_score(bundle, values: dict) -> Optional[float]:
    """Score a feature dict against a loaded bundle (median-impute missing)."""
    if bundle is None:
        return None
    med = bundle.get("feature_medians", {})
    x = np.array([[values.get(f, med.get(f, 0.0)) for f in bundle["features"]]], dtype=float)
    x = bundle["scaler"].transform(x)
    return max(0.0, min(1.0, float(bundle["model"].predict_proba(x)[0, 1])))


app = FastAPI(
    title="NER Landslide Risk AI Service",
    version="1.0.0",
    description="Monsoon landslide risk scoring for predictive rerouting.",
)

# --- Region tuning: the 8 NER states sit in a high-rainfall, steep-terrain belt.
# Latitudes roughly 22N-29N, longitudes 88E-97E. Points inside this envelope are
# treated as intrinsically more exposed to slope failure.
NER_LAT_RANGE = (22.0, 29.5)
NER_LNG_RANGE = (88.0, 97.5)


class PredictRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    rainfall_mm: float = Field(0.0, ge=0, le=2000, description="Rainfall last 24h")
    soil_moisture: float = Field(0.0, ge=0.0, le=1.0, description="0-1 saturation")
    slope: float = Field(0.0, ge=0.0, le=90.0, description="Terrain slope in degrees")
    elevation: Optional[float] = Field(
        None, ge=-500, le=9000,
        description="Terrain elevation (m); optional — imputed if omitted")


class PredictResponse(BaseModel):
    risk_score: float = Field(..., ge=0.0, le=1.0)
    recommended_action: Literal["PROCEED", "CAUTION", "REROUTE", "HALT"]
    severity_band: Literal["low", "moderate", "high", "critical"]
    factors: dict


def _in_ner_envelope(lat: float, lng: float) -> bool:
    return (
        NER_LAT_RANGE[0] <= lat <= NER_LAT_RANGE[1]
        and NER_LNG_RANGE[0] <= lng <= NER_LNG_RANGE[1]
    )


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def _heuristic_features(req: PredictRequest) -> dict:
    """Normalize raw inputs into 0-1 contribution factors."""
    # Rainfall: saturating response — beyond ~250mm/24h the marginal effect
    # flattens, but the base risk is already high (monsoon cloudburst regime).
    rain_factor = 1.0 - math.exp(-req.rainfall_mm / 120.0)

    # Soil moisture is already 0-1; near-saturation sharply raises pore pressure.
    moisture_factor = req.soil_moisture ** 0.75

    # Slope: failures cluster between ~25 and ~55 degrees. Model as a smooth
    # ramp that peaks near 45 deg and stays high on steeper faces.
    slope_factor = min(1.0, (req.slope / 45.0)) if req.slope <= 45 else min(
        1.0, 0.9 + (req.slope - 45.0) / 450.0
    )

    # Regional exposure multiplier for the NER terrain belt.
    region_factor = 1.0 if _in_ner_envelope(req.latitude, req.longitude) else 0.6

    return {
        "rain_factor": round(rain_factor, 4),
        "moisture_factor": round(moisture_factor, 4),
        "slope_factor": round(slope_factor, 4),
        "region_factor": round(region_factor, 4),
    }


def _heuristic_score(f: dict) -> float:
    """
    Weighted logistic combination of the factors. Weights reflect that
    antecedent soil saturation and slope dominate landslide initiation, with
    rainfall as the immediate trigger.
    """
    z = (
        -3.2
        + 3.6 * f["rain_factor"]
        + 3.9 * f["moisture_factor"]
        + 3.1 * f["slope_factor"]
    )
    base = _sigmoid(z)
    return max(0.0, min(1.0, base * f["region_factor"]))


# ---------------------------------------------------------------------------
# Lightweight ML model: trained once at import on synthetic, physically-labelled
# samples so /predict returns a blended (heuristic + learned) score.
# ---------------------------------------------------------------------------
def _train_synthetic_model() -> LogisticRegression:
    rng = np.random.default_rng(42)
    n = 4000
    rainfall = rng.uniform(0, 400, n)
    moisture = rng.uniform(0, 1, n)
    slope = rng.uniform(0, 70, n)

    rain_f = 1.0 - np.exp(-rainfall / 120.0)
    moist_f = moisture ** 0.75
    slope_f = np.clip(slope / 45.0, 0, 1)

    z = -3.2 + 3.6 * rain_f + 3.9 * moist_f + 3.1 * slope_f
    prob = 1.0 / (1.0 + np.exp(-z))
    labels = (prob + rng.normal(0, 0.08, n) > 0.5).astype(int)

    X = np.column_stack([rain_f, moist_f, slope_f])
    model = LogisticRegression(max_iter=500)
    model.fit(X, labels)
    return model


_MODEL = _train_synthetic_model()


def _model_score(f: dict) -> float:
    X = np.array([[f["rain_factor"], f["moisture_factor"], f["slope_factor"]]])
    prob = float(_MODEL.predict_proba(X)[0, 1])
    return max(0.0, min(1.0, prob * f["region_factor"]))


def _trained_score(req: PredictRequest) -> Optional[float]:
    """Score with the real-data model.pkl (if loaded). Returns None otherwise."""
    if _TRAINED is None:
        return None
    feats = _TRAINED["features"]
    med = _TRAINED.get("feature_medians", {})
    raw = {
        "rainfall_mm": req.rainfall_mm,
        "soil_moisture": req.soil_moisture,
        "slope": req.slope,
        "elevation": req.elevation if req.elevation is not None else med.get("elevation", 1000.0),
        "abs_lat": abs(req.latitude),
    }
    x = np.array([[raw.get(name, med.get(name, 0.0)) for name in feats]], dtype=float)
    x = _TRAINED["scaler"].transform(x)
    return max(0.0, min(1.0, float(_TRAINED["model"].predict_proba(x)[0, 1])))


def _action_for(score: float) -> tuple[str, str]:
    if score >= 0.80:
        return "HALT", "critical"
    if score >= 0.60:
        return "REROUTE", "high"
    if score >= 0.35:
        return "CAUTION", "moderate"
    return "PROCEED", "low"


@app.get("/health")
def health() -> dict:
    if _TRAINED is not None:
        model_desc = f"trained:{_TRAINED.get('model_type')}+heuristic"
    else:
        model_desc = "synthetic-logreg+heuristic"
    return {
        "status": "ok",
        "service": "ner-ai-service",
        "model": model_desc,
        "trained_model": _TRAINED is not None,
        "data_source": _TRAINED.get("data_source") if _TRAINED else None,
        "models": {
            "landslide": bool(_TRAINED),
            "flood": bool(_FLOOD),
            "congestion": bool(_CONGESTION),
        },
    }


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest) -> PredictResponse:
    factors = _heuristic_features(req)
    h = _heuristic_score(factors)

    # Prefer the real-data model.pkl; fall back to the in-process synthetic model.
    trained = _trained_score(req)
    if trained is not None:
        m = trained
        model_src = _TRAINED.get("model_type", "trained")
    else:
        m = _model_score(factors)
        model_src = "synthetic"

    # Blend heuristic and learned score (0.5/0.5). The heuristic keeps the output
    # physically grounded; the trained model adds the real-data decision boundary.
    risk = round(0.5 * h + 0.5 * m, 4)

    action, band = _action_for(risk)
    return PredictResponse(
        risk_score=risk,
        recommended_action=action,  # type: ignore[arg-type]
        severity_band=band,          # type: ignore[arg-type]
        factors={
            **factors,
            "heuristic_score": round(h, 4),
            "model_score": round(m, 4),
            "model_source": model_src,
        },
    )


# ---------------------------------------------------------------------------
# Flood risk — trained on the Dartmouth Flood Observatory archive (real events)
# + Open-Meteo features. Falls back to a physics heuristic if the model is absent.
# ---------------------------------------------------------------------------
class FloodRequest(BaseModel):
    rainfall_mm: float = Field(0.0, ge=0, le=2000)
    soil_moisture: float = Field(0.0, ge=0.0, le=1.0)
    elevation: float = Field(500.0, ge=-500, le=9000)
    slope: float = Field(0.0, ge=0.0, le=90.0)


class HazardResponse(BaseModel):
    risk_score: float
    recommended_action: str
    model_source: str


def _flood_heuristic(r: FloodRequest) -> float:
    rain = 1 - math.exp(-r.rainfall_mm / 80.0)
    low = max(0.0, min(1.0, (600 - r.elevation) / 600))
    flat = max(0.0, min(1.0, (12 - r.slope) / 12))
    return _sigmoid(-2.5 + 3.2 * rain + 2.2 * low + 1.4 * flat)


@app.post("/predict/flood", response_model=HazardResponse)
def predict_flood(req: FloodRequest) -> HazardResponse:
    m = _bundle_score(_FLOOD, {
        "rainfall_mm": req.rainfall_mm, "soil_moisture": req.soil_moisture,
        "elevation": req.elevation, "slope": req.slope,
    })
    src = _FLOOD.get("model_type", "trained") if (_FLOOD and m is not None) else "heuristic"
    h = _flood_heuristic(req)
    score = round(0.5 * h + 0.5 * m, 4) if m is not None else round(h, 4)
    action, _ = _action_for(score)
    return HazardResponse(risk_score=score, recommended_action=action, model_source=src)


# ---------------------------------------------------------------------------
# Congestion risk — trained on the UCI Metro Interstate Traffic Volume dataset
# (real hourly traffic). Predicts a time/weather baseline; the backend blends it
# with live fleet telemetry.
# ---------------------------------------------------------------------------
class CongestionRequest(BaseModel):
    hour: int = Field(..., ge=0, le=23)
    day_of_week: int = Field(..., ge=0, le=6)
    is_weekend: int = Field(0, ge=0, le=1)
    rain_mm: float = Field(0.0, ge=0, le=200)


@app.post("/predict/congestion", response_model=HazardResponse)
def predict_congestion(req: CongestionRequest) -> HazardResponse:
    m = _bundle_score(_CONGESTION, {
        "hour": req.hour, "day_of_week": req.day_of_week,
        "is_weekend": req.is_weekend, "rain_mm": req.rain_mm,
    })
    if m is None:
        # Heuristic: rush-hour peaks on weekdays.
        peak = 1.0 if (7 <= req.hour <= 10 or 16 <= req.hour <= 19) else 0.3
        m = peak * (0.5 if req.is_weekend else 1.0)
        src = "heuristic"
    else:
        src = _CONGESTION.get("model_type", "trained")
    score = round(max(0.0, min(1.0, m)), 4)
    action, _ = _action_for(score)
    return HazardResponse(risk_score=score, recommended_action=action, model_source=src)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=9000, reload=False)
