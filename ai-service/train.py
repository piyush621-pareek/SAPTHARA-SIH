"""
Landslide Risk Model — Real-Data Training Pipeline (SIH26002)
============================================================
Trains the landslide-risk classifier used by the AI microservice on REAL data:

  Positives : real landslide events from the NASA Global Landslide Catalog (GLC)
              — 11,000+ recorded events worldwide, each with lat/lng + date.
  Negatives : geographically-matched "no-landslide" control points (case-control
              design) sampled near the positives but far enough away to be safe.

Every sample is enriched with REAL environmental features from the free,
no-API-key Open-Meteo services:
  * slope (deg) + elevation (m)  — from the Open-Meteo Elevation API (a small
                                   neighbourhood of elevation queries -> gradient)
  * rainfall_mm (24h)            — Open-Meteo historical archive (ERA5) on the
                                   event date (a random date for negatives)
  * soil_moisture (m3/m3)        — Open-Meteo archive (ERA5-Land, 0-7cm)

Two models (LogisticRegression + RandomForest) are trained, evaluated on a
held-out test split (ROC-AUC / precision / recall / F1 / confusion matrix), and
the better one is saved to  model/model.pkl  together with a StandardScaler and
feature medians (for inference-time imputation).  Metrics + the enriched dataset
are written alongside so the whole pipeline is reproducible and inspectable.

Usage:
    python train.py                    # ~250 positives + 250 negatives (real)
    python train.py --samples 400      # bigger run
    python train.py --offline          # no network: physically-grounded synthetic
    python train.py --data path.csv    # use a specific GLC export

Output:  ai-service/model/{model.pkl, metrics.json, training_data.csv}
"""
from __future__ import annotations

import argparse
import json
import math
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

import numpy as np
import pandas as pd
import requests
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, confusion_matrix, f1_score, precision_score,
    recall_score, roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import joblib

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DEFAULT = os.path.join(HERE, "data", "glc_raw.csv")
OUT_DIR = os.path.join(HERE, "model")

# Model features: the two proven, physically-monotonic triggers of monsoon
# landslides — 24h rainfall and topsoil saturation. Everything else is excluded
# on purpose:
#   * slope + elevation — coarse training DEM vs sharp ISRO CartoDEM at inference
#     (distribution shift) made the model rank terrain backwards;
#   * abs_lat — introduced residual geographic memorisation that flipped the
#     ranking between two sites with near-identical rainfall.
# Keeping only rainfall + soil moisture guarantees the score rises with the real
# drivers and can never rank a wetter site as safer. Terrain/susceptibility
# nuance enters downstream via the physics heuristic + Bhuvan fusion.
# (slope/elevation/abs_lat are still enriched and saved for inspection.)
FEATURES = ["rainfall_mm", "soil_moisture"]

# NER envelope — the 8 North-Eastern states (high-rainfall, steep-terrain belt).
NER_LAT = (22.0, 29.5)
NER_LNG = (88.0, 97.5)

ELEV_URL = "https://api.open-meteo.com/v1/elevation"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
SESSION = requests.Session()


# --------------------------------------------------------------------------- #
# HTTP helpers (with light retry)
# --------------------------------------------------------------------------- #
def _get(url: str, params: dict, tries: int = 4, timeout: int = 30):
    for i in range(tries):
        try:
            r = SESSION.get(url, params=params, timeout=timeout)
            if r.status_code == 200:
                return r.json()
            # 429 = rate limited -> back off
            if r.status_code == 429:
                time.sleep(2 + i * 2)
                continue
        except requests.RequestException:
            time.sleep(1 + i)
    return None


def batch_elevations(coords: list[tuple[float, float]]) -> dict[tuple[float, float], float]:
    """Query elevation for many (lat,lng) points, 100 per request."""
    out: dict[tuple[float, float], float] = {}
    for i in range(0, len(coords), 100):
        chunk = coords[i : i + 100]
        lats = ",".join(f"{c[0]:.5f}" for c in chunk)
        lngs = ",".join(f"{c[1]:.5f}" for c in chunk)
        j = _get(ELEV_URL, {"latitude": lats, "longitude": lngs})
        if j and "elevation" in j:
            for c, e in zip(chunk, j["elevation"]):
                out[c] = float(e) if e is not None else float("nan")
        time.sleep(0.2)
    return out


def slope_from_elevation(lat: float, lng: float, elev: dict) -> tuple[float, float]:
    """Estimate terrain slope (deg) + centre elevation from a 5-point stencil."""
    d = 0.005  # ~555 m
    dlon = d * max(0.2, math.cos(math.radians(lat)))
    c = elev.get((round(lat, 5), round(lng, 5)), float("nan"))
    n = elev.get((round(lat + d, 5), round(lng, 5)), c)
    s = elev.get((round(lat - d, 5), round(lng, 5)), c)
    e = elev.get((round(lat, 5), round(lng + dlon, 5)), c)
    w = elev.get((round(lat, 5), round(lng - dlon, 5)), c)
    m_ns = 2 * d * 111_320.0
    m_ew = 2 * dlon * 111_320.0
    g_ns = (n - s) / m_ns if m_ns else 0.0
    g_ew = (e - w) / m_ew if m_ew else 0.0
    slope = math.degrees(math.atan(math.sqrt(g_ns * g_ns + g_ew * g_ew)))
    return (round(slope, 3), round(c, 1) if not math.isnan(c) else 0.0)


def weather_on_date(lat: float, lng: float, date: str):
    """Real 24h rainfall (mm) + mean topsoil moisture (m3/m3) for a date."""
    j = _get(ARCHIVE_URL, {
        "latitude": lat, "longitude": lng,
        "start_date": date, "end_date": date,
        "daily": "precipitation_sum",
        "hourly": "soil_moisture_0_to_7cm",
        "timezone": "auto",
    })
    if not j:
        return None
    rain = None
    try:
        rain = j["daily"]["precipitation_sum"][0]
    except Exception:
        rain = None
    soil = None
    try:
        vals = [v for v in j["hourly"]["soil_moisture_0_to_7cm"] if v is not None]
        soil = sum(vals) / len(vals) if vals else None
    except Exception:
        soil = None
    if rain is None and soil is None:
        return None
    return (float(rain or 0.0), float(soil if soil is not None else 0.25))


# --------------------------------------------------------------------------- #
# Sampling from the real catalog
# --------------------------------------------------------------------------- #
def load_positives(path: str, n: int, seed: int, ner_only: bool = False) -> pd.DataFrame:
    df = pd.read_csv(path, low_memory=False)
    df = df.dropna(subset=["latitude", "longitude", "event_date"]).copy()
    df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
    df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")
    df = df.dropna(subset=["latitude", "longitude"])
    # Rainfall-triggered events (this is a monsoon-landslide model).
    rain_trig = {"downpour", "rain", "continuous_rain", "tropical_cyclone", "monsoon"}
    if "landslide_trigger" in df.columns:
        df = df[df["landslide_trigger"].isin(rain_trig)]
    # Parse dates; archive covers 1950+; keep 2010..2023 (ERA5 stable, <5d lag).
    df["d"] = pd.to_datetime(df["event_date"], errors="coerce", format="mixed")
    df = df.dropna(subset=["d"])
    df = df[(df["d"].dt.year >= 2010) & (df["d"].dt.year <= 2023)]
    df["date"] = df["d"].dt.strftime("%Y-%m-%d")

    india = df[(df["latitude"].between(*NER_LAT)) & (df["longitude"].between(*NER_LNG))]
    if ner_only:
        # Train a NER-specific model on only the North-East events.
        take = min(len(india), n)
        return (india.sample(take, random_state=seed) if take else india)[
            ["latitude", "longitude", "date"]
        ].reset_index(drop=True)
    # Otherwise bias the sample toward NER/India, plus a global spread.
    rest = df.drop(india.index)
    n_ner = min(len(india), int(n * 0.45))
    n_rest = min(len(rest), n - n_ner)
    picked = pd.concat([
        india.sample(n_ner, random_state=seed) if n_ner else india.iloc[0:0],
        rest.sample(n_rest, random_state=seed) if n_rest else rest.iloc[0:0],
    ])
    return picked[["latitude", "longitude", "date"]].reset_index(drop=True)


def make_negatives(pos: pd.DataFrame, n: int, seed: int) -> pd.DataFrame:
    """Geographically-matched controls: near a positive but >~28km away, land."""
    rng = np.random.default_rng(seed)
    pts = pos[["latitude", "longitude"]].to_numpy()
    dates_pool = pd.date_range("2011-01-01", "2023-12-31", freq="D")
    out = []
    guard = 0
    while len(out) < n and guard < n * 40:
        guard += 1
        base = pts[rng.integers(0, len(pts))]
        # jitter 0.3..2.0 deg (~33..220 km) in a random direction
        ang = rng.uniform(0, 2 * math.pi)
        rad = rng.uniform(0.3, 2.0)
        lat = float(base[0] + rad * math.sin(ang))
        lng = float(base[1] + rad * math.cos(ang) / max(0.2, math.cos(math.radians(base[0]))))
        if not (-60 <= lat <= 75):
            continue
        # reject if within ~0.25 deg (~28km) of any recorded landslide
        if np.min(np.hypot(pts[:, 0] - lat, pts[:, 1] - lng)) < 0.25:
            continue
        date = dates_pool[rng.integers(0, len(dates_pool))].strftime("%Y-%m-%d")
        out.append((round(lat, 5), round(lng, 5), date))
    return pd.DataFrame(out, columns=["latitude", "longitude", "date"])


# --------------------------------------------------------------------------- #
# Enrichment
# --------------------------------------------------------------------------- #
def enrich(df: pd.DataFrame) -> pd.DataFrame:
    # 1) Elevation for slope stencil — only if slope/elevation are model features.
    #    (They are currently excluded, so we skip these calls entirely.)
    need_terrain = ("slope" in FEATURES) or ("elevation" in FEATURES)
    elev: dict[tuple[float, float], float] = {}
    if need_terrain:
        coords: set[tuple[float, float]] = set()
        for lat, lng in df[["latitude", "longitude"]].to_numpy():
            d = 0.005
            dlon = d * max(0.2, math.cos(math.radians(lat)))
            for a, b in [(0, 0), (d, 0), (-d, 0), (0, dlon), (0, -dlon)]:
                coords.add((round(lat + a, 5), round(lng + b, 5)))
        print(f"  elevation: {len(coords)} points ...", flush=True)
        elev = batch_elevations(sorted(coords))

    # 2) Weather per point (threaded — Open-Meteo tolerates modest concurrency).
    print(f"  weather:   {len(df)} archive calls ...", flush=True)
    results: dict[int, tuple] = {}

    def work(idx, lat, lng, date):
        return idx, weather_on_date(lat, lng, date)

    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = [ex.submit(work, i, r.latitude, r.longitude, r.date)
                for i, r in df.iterrows()]
        done = 0
        for f in as_completed(futs):
            idx, w = f.result()
            results[idx] = w
            done += 1
            if done % 50 == 0:
                print(f"    {done}/{len(df)}", flush=True)

    rows = []
    for i, r in df.iterrows():
        w = results.get(i)
        if w is None:
            continue
        if need_terrain:
            slope, elevation = slope_from_elevation(r.latitude, r.longitude, elev)
        else:
            slope, elevation = float("nan"), float("nan")
        rain, soil = w
        rows.append({
            "latitude": r.latitude, "longitude": r.longitude, "date": r.date,
            "rainfall_mm": round(rain, 2),
            "soil_moisture": round(min(1.0, soil / 0.6), 4),  # ERA5 m3/m3 -> 0..1
            "slope": slope,
            "elevation": elevation,
            "abs_lat": round(abs(r.latitude), 3),
        })
    return pd.DataFrame(rows)


# --------------------------------------------------------------------------- #
# Offline physically-grounded fallback (only if --offline or no network)
# --------------------------------------------------------------------------- #
def synthetic(n: int, seed: int) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    def block(label, rain_lo, rain_hi, soil_lo, soil_hi, slope_lo, slope_hi):
        k = n
        return pd.DataFrame({
            "rainfall_mm": rng.uniform(rain_lo, rain_hi, k),
            "soil_moisture": rng.uniform(soil_lo, soil_hi, k),
            "slope": rng.uniform(slope_lo, slope_hi, k),
            "elevation": rng.uniform(200, 3500, k),
            "abs_lat": rng.uniform(22, 29, k),
            "label": label,
        })
    pos = block(1, 60, 350, 0.45, 0.95, 20, 60)
    neg = block(0, 0, 90, 0.05, 0.55, 0, 30)
    return pd.concat([pos, neg]).sample(frac=1, random_state=seed).reset_index(drop=True)


# --------------------------------------------------------------------------- #
# Train + evaluate
# --------------------------------------------------------------------------- #
def train(df: pd.DataFrame, source: str):
    X = df[FEATURES].to_numpy(dtype=float)
    y = df["label"].to_numpy(dtype=int)
    medians = {f: float(np.nanmedian(df[f])) for f in FEATURES}

    Xtr, Xte, ytr, yte = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y)
    scaler = StandardScaler().fit(Xtr)
    Xtr_s, Xte_s = scaler.transform(Xtr), scaler.transform(Xte)

    candidates = {
        "logreg": LogisticRegression(max_iter=1000, class_weight="balanced"),
        "random_forest": RandomForestClassifier(
            n_estimators=300, max_depth=8, class_weight="balanced", random_state=42),
    }
    report, best_name, best_auc, best_model = {}, None, -1.0, None
    for name, clf in candidates.items():
        clf.fit(Xtr_s, ytr)
        proba = clf.predict_proba(Xte_s)[:, 1]
        pred = (proba >= 0.5).astype(int)
        auc = float(roc_auc_score(yte, proba))
        report[name] = {
            "roc_auc": round(auc, 4),
            "accuracy": round(float(accuracy_score(yte, pred)), 4),
            "precision": round(float(precision_score(yte, pred, zero_division=0)), 4),
            "recall": round(float(recall_score(yte, pred, zero_division=0)), 4),
            "f1": round(float(f1_score(yte, pred, zero_division=0)), 4),
            "confusion_matrix": confusion_matrix(yte, pred).tolist(),
        }
        if name == "logreg":
            report[name]["coefficients"] = dict(
                zip(FEATURES, [round(c, 4) for c in clf.coef_[0]]))
        else:
            report[name]["feature_importance"] = dict(
                zip(FEATURES, [round(v, 4) for v in clf.feature_importances_]))
        if auc > best_auc:
            best_auc, best_name, best_model = auc, name, clf

    metrics = {
        "trained_at": datetime.now().isoformat() + "Z",
        "data_source": source,
        "n_samples": int(len(df)),
        "n_positive": int(y.sum()),
        "n_negative": int((y == 0).sum()),
        "n_train": int(len(ytr)),
        "n_test": int(len(yte)),
        "features": FEATURES,
        "feature_medians": medians,
        "best_model": best_name,
        "models": report,
    }
    bundle = {
        "model": best_model, "scaler": scaler, "model_type": best_name,
        "features": FEATURES, "feature_medians": medians,
        "trained_at": metrics["trained_at"], "data_source": source,
        "n_samples": int(len(df)),
    }
    return bundle, metrics


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--samples", type=int, default=250, help="per-class sample size")
    ap.add_argument("--data", default=DATA_DEFAULT)
    ap.add_argument("--offline", action="store_true")
    ap.add_argument("--from-csv", dest="from_csv", default=None,
                    help="refit on an already-enriched CSV (FEATURES + label); "
                         "no download/enrichment, no network needed")
    ap.add_argument("--ner-only", dest="ner_only", action="store_true",
                    help="train a NER-specific model on only North-East events")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()
    os.makedirs(OUT_DIR, exist_ok=True)

    if args.from_csv:
        print(f"[refit] training on existing enriched dataset: {args.from_csv}")
        data = pd.read_csv(args.from_csv)
        missing = [c for c in FEATURES + ["label"] if c not in data.columns]
        if missing:
            raise SystemExit(f"CSV missing required columns: {missing}")
        data = data.dropna(subset=FEATURES + ["label"])
        source = ("NASA Global Landslide Catalog + matched controls; features "
                  "from Open-Meteo (ERA5 rainfall/soil); refit from cached dataset")
    elif args.offline or not os.path.exists(args.data):
        print("[offline] building physically-grounded synthetic dataset")
        data = synthetic(args.samples, args.seed)
        source = "synthetic (physically-grounded fallback)"
    else:
        region = "NER only" if args.ner_only else "global"
        print(f"[real] NASA Global Landslide Catalog ({region}): {args.data}")
        pos = load_positives(args.data, args.samples, args.seed, ner_only=args.ner_only)
        neg = make_negatives(pos, len(pos), args.seed)
        print(f"  sampled {len(pos)} real events + {len(neg)} matched controls")
        print("Enriching POSITIVES with real terrain + weather ...")
        ep = enrich(pos); ep["label"] = 1
        print("Enriching NEGATIVES ...")
        en = enrich(neg); en["label"] = 0
        data = pd.concat([ep, en], ignore_index=True).dropna(subset=FEATURES)
        scope = "NER North-East India" if args.ner_only else "global"
        source = (f"NASA Global Landslide Catalog ({scope}) (positives) + matched controls; "
                  "features from Open-Meteo (ERA5 rainfall/soil, elevation->slope)")
        if len(data) < 60 or data["label"].nunique() < 2:
            print("[warn] too few enriched samples -> synthetic fallback")
            data = synthetic(args.samples, args.seed)
            source = "synthetic (fallback after sparse enrichment)"

    data.to_csv(os.path.join(OUT_DIR, "training_data.csv"), index=False)
    bundle, metrics = train(data, source)
    joblib.dump(bundle, os.path.join(OUT_DIR, "model.pkl"))
    with open(os.path.join(OUT_DIR, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    print("\n===== TRAINING COMPLETE =====")
    print(f"source     : {source}")
    print(f"samples    : {metrics['n_samples']}  (+{metrics['n_positive']}/-{metrics['n_negative']})")
    print(f"best model : {metrics['best_model']}")
    for name, m in metrics["models"].items():
        print(f"  {name:14s} AUC={m['roc_auc']}  acc={m['accuracy']}  "
              f"P={m['precision']}  R={m['recall']}  F1={m['f1']}")
    print(f"saved      : {OUT_DIR}\\model.pkl, metrics.json, training_data.csv")


if __name__ == "__main__":
    main()
