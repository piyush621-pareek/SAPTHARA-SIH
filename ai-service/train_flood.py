"""
Flood Risk Model — Real-Data Training (SIH26002)
================================================
Trains the flood-risk classifier on REAL data:

  Positives : real flood events from the Dartmouth Flood Observatory (DFO)
              Global Active Archive of Large Flood Events (4,000+ events with
              centroid lat/lng + date + cause), biased toward India/NER.
  Negatives : geographically-matched control points (no recorded flood).

Each sample is enriched with REAL features from Open-Meteo (reusing the landslide
pipeline's helpers): rainfall (event date), soil moisture, elevation and slope.
Floods concentrate where heavy rain meets low, flat ground — the model learns
that from data. Output: model/flood_model.pkl + model/flood_metrics.json.

Usage:  python train_flood.py --samples 180
"""
from __future__ import annotations

import argparse
import json
import math
import os
import zipfile
from datetime import datetime

import time

import numpy as np
import pandas as pd
import requests
import shapefile  # pyshp
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, confusion_matrix, f1_score, precision_score,
    recall_score, roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import joblib

# Reuse the real-data enrichment primitives from the landslide pipeline.
from train import batch_elevations, weather_on_date, slope_from_elevation, make_negatives

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "model")
DFO_ZIP = os.path.join(HERE, "data", "flood", "dfo.zip")

FEATURES = ["rainfall_mm", "soil_moisture", "elevation", "slope"]
NER_LAT = (22.0, 29.5)
NER_LNG = (88.0, 97.5)


def load_flood_positives(n: int, seed: int) -> pd.DataFrame:
    with zipfile.ZipFile(DFO_ZIP) as z:
        z.extractall(os.path.join(HERE, "data", "flood", "x"))
    base = os.path.join(HERE, "data", "flood", "x", "wlf_nhr_fl_dfomasterlist_20190418")
    r = shapefile.Reader(base)
    fields = [f[0] for f in r.fields[1:]]
    rows = []
    for rec in r.records():
        d = dict(zip(fields, rec))
        lat, lng = d.get("Centroid_Y"), d.get("Centroid_X")
        began = d.get("Began")
        if lat is None or lng is None or began is None:
            continue
        try:
            date = began.strftime("%Y-%m-%d")
            year = began.year
        except Exception:
            continue
        if not (1980 <= year <= 2018):
            continue
        # Rain-driven floods (this is a monsoon-flood model).
        cause = str(d.get("Main_cause", "")).lower()
        if not any(k in cause for k in ["rain", "monsoon", "torrential", "tropical", "storm"]):
            continue
        rows.append({"latitude": float(lat), "longitude": float(lng), "date": date})
    df = pd.DataFrame(rows).dropna()
    df = df[(df.latitude.between(-60, 75))]
    # Restrict archive dates to the ERA5-stable window used by enrichment.
    df = df[pd.to_datetime(df.date).dt.year.between(2010, 2018)]
    india = df[(df.latitude.between(*NER_LAT)) & (df.longitude.between(*NER_LNG))]
    rest = df.drop(india.index)
    # Broaden the "regional" bias to all of India-ish latitudes for more samples.
    subcont = rest[(rest.latitude.between(8, 30)) & (rest.longitude.between(68, 98))]
    rest = rest.drop(subcont.index)
    n_reg = min(len(india) + len(subcont), int(n * 0.6))
    reg = pd.concat([india, subcont]).sample(min(n_reg, len(india) + len(subcont)), random_state=seed) if (len(india) + len(subcont)) else df.iloc[0:0]
    n_rest = min(len(rest), n - len(reg))
    picked = pd.concat([reg, rest.sample(n_rest, random_state=seed) if n_rest else rest.iloc[0:0]])
    return picked[["latitude", "longitude", "date"]].reset_index(drop=True)


IFI_CSV = os.path.join(HERE, "data", "flood", "ifi_v3.csv")
NER_STATES = ["Assam", "Arunachal Pradesh", "Manipur", "Meghalaya",
              "Mizoram", "Nagaland", "Sikkim", "Tripura"]
_GEO_CACHE: dict[str, tuple] = {}


def geocode(name: str):
    """Open-Meteo geocoding for an NER place name -> (lat, lng) inside the NER box."""
    if name in _GEO_CACHE:
        return _GEO_CACHE[name]
    for attempt in range(3):
        try:
            r = requests.get(
                "https://geocoding-api.open-meteo.com/v1/search",
                params={"name": name, "count": 5, "countryCode": "IN"},
                timeout=20,
            )
            if r.status_code == 200:
                for res in r.json().get("results", []):
                    lat, lng = res.get("latitude"), res.get("longitude")
                    if lat is not None and 22 <= lat <= 29.5 and 88 <= lng <= 97.5:
                        _GEO_CACHE[name] = (float(lat), float(lng))
                        return _GEO_CACHE[name]
                break
        except requests.RequestException:
            time.sleep(1 + attempt)
    _GEO_CACHE[name] = None
    return None


def load_ifi_ner_positives(n: int, seed: int) -> pd.DataFrame:
    """Real NER flood events from the India Flood Inventory, geocoded by district."""
    df = pd.read_csv(IFI_CSV, low_memory=False)
    df.columns = [c.strip() for c in df.columns]
    # Keep events whose PRIMARY (first-listed) state is in the NER.
    def primary_ner(s):
        if not isinstance(s, str) or not s.strip():
            return False
        return s.split(",")[0].strip() in NER_STATES
    df = df[df["State"].apply(primary_ner)].copy()
    df["d"] = pd.to_datetime(df["Start Date"], format="%d-%m-%Y %H:%M", errors="coerce")
    df = df.dropna(subset=["d"])
    df = df[(df["d"].dt.year >= 2010) & (df["d"].dt.year <= 2023)]
    cause = df["Main Cause"].astype(str).str.lower()
    df = df[cause.str.contains("rain|flood|monsoon|brahmaputra|cyclone", na=False)]
    df["district"] = df["Districts"].astype(str).str.split(",").str[0].str.strip()
    df = df[df["district"].str.len() > 1]
    if len(df) > n:
        df = df.sample(n, random_state=seed)
    print(f"  geocoding {df['district'].nunique()} unique NER districts ...", flush=True)
    rows = []
    for _, r in df.iterrows():
        c = geocode(r["district"])
        if c is None:
            continue
        rows.append({"latitude": c[0], "longitude": c[1], "date": r["d"].strftime("%Y-%m-%d")})
    out = pd.DataFrame(rows).drop_duplicates().reset_index(drop=True)
    print(f"  geocoded {len(out)} NER flood events", flush=True)
    return out


def enrich_flood(df: pd.DataFrame) -> pd.DataFrame:
    coords = set()
    for lat, lng in df[["latitude", "longitude"]].to_numpy():
        d = 0.005
        dlon = d * max(0.2, math.cos(math.radians(lat)))
        for a, b in [(0, 0), (d, 0), (-d, 0), (0, dlon), (0, -dlon)]:
            coords.add((round(lat + a, 5), round(lng + b, 5)))
    print(f"  elevation: {len(coords)} points ...", flush=True)
    elev = batch_elevations(sorted(coords))

    from concurrent.futures import ThreadPoolExecutor, as_completed
    print(f"  weather: {len(df)} archive calls ...", flush=True)
    results = {}
    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = {ex.submit(weather_on_date, r.latitude, r.longitude, r.date): i
                for i, r in df.iterrows()}
        done = 0
        for f in as_completed(futs):
            results[futs[f]] = f.result()
            done += 1
            if done % 50 == 0:
                print(f"    {done}/{len(df)}", flush=True)

    out = []
    for i, r in df.iterrows():
        w = results.get(i)
        if w is None:
            continue
        rain, soil = w
        slope, elevation = slope_from_elevation(r.latitude, r.longitude, elev)
        out.append({
            "latitude": r.latitude, "longitude": r.longitude, "date": r.date,
            "rainfall_mm": round(rain, 2),
            "soil_moisture": round(min(1.0, soil / 0.6), 4),
            "elevation": elevation,
            "slope": slope,
        })
    return pd.DataFrame(out)


def train(df: pd.DataFrame, source: str):
    X = df[FEATURES].to_numpy(dtype=float)
    y = df["label"].to_numpy(dtype=int)
    medians = {f: float(np.nanmedian(df[f])) for f in FEATURES}
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)
    scaler = StandardScaler().fit(Xtr)
    Xtr_s, Xte_s = scaler.transform(Xtr), scaler.transform(Xte)
    cands = {
        "logreg": LogisticRegression(max_iter=1000, class_weight="balanced"),
        "random_forest": RandomForestClassifier(n_estimators=300, max_depth=8, class_weight="balanced", random_state=42),
    }
    report, best, best_auc, best_model = {}, None, -1, None
    for name, clf in cands.items():
        clf.fit(Xtr_s, ytr)
        p = clf.predict_proba(Xte_s)[:, 1]
        pred = (p >= 0.5).astype(int)
        auc = float(roc_auc_score(yte, p))
        report[name] = {
            "roc_auc": round(auc, 4), "accuracy": round(float(accuracy_score(yte, pred)), 4),
            "precision": round(float(precision_score(yte, pred, zero_division=0)), 4),
            "recall": round(float(recall_score(yte, pred, zero_division=0)), 4),
            "f1": round(float(f1_score(yte, pred, zero_division=0)), 4),
            "confusion_matrix": confusion_matrix(yte, pred).tolist(),
        }
        if name == "logreg":
            report[name]["coefficients"] = dict(zip(FEATURES, [round(c, 4) for c in clf.coef_[0]]))
        else:
            report[name]["feature_importance"] = dict(zip(FEATURES, [round(v, 4) for v in clf.feature_importances_]))
        if auc > best_auc:
            best_auc, best, best_model = auc, name, clf
    metrics = {
        "trained_at": datetime.now().isoformat() + "Z", "data_source": source,
        "n_samples": int(len(df)), "n_positive": int(y.sum()), "n_negative": int((y == 0).sum()),
        "features": FEATURES, "feature_medians": medians, "best_model": best, "models": report,
    }
    bundle = {"model": best_model, "scaler": scaler, "model_type": best, "features": FEATURES,
              "feature_medians": medians, "trained_at": metrics["trained_at"], "data_source": source}
    return bundle, metrics


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--samples", type=int, default=180)
    ap.add_argument("--from-csv", dest="from_csv", default=None)
    ap.add_argument("--ifi", action="store_true",
                    help="use the India Flood Inventory, NER-filtered (default: global DFO)")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()
    os.makedirs(OUT_DIR, exist_ok=True)

    if args.from_csv:
        print(f"[refit] {args.from_csv}")
        data = pd.read_csv(args.from_csv).dropna(subset=FEATURES + ["label"])
        source = "flood archive + matched controls; Open-Meteo features (refit from cache)"
    else:
        if args.ifi:
            pos = load_ifi_ner_positives(args.samples, args.seed)
            src_name = "India Flood Inventory (NER states, district-geocoded)"
        else:
            pos = load_flood_positives(args.samples, args.seed)
            src_name = "Dartmouth Flood Observatory Global Active Archive"
        neg = make_negatives(pos, len(pos), args.seed)
        print(f"[real] {src_name}: {len(pos)} positives + {len(neg)} controls")
        print("Enriching POSITIVES ..."); ep = enrich_flood(pos); ep["label"] = 1
        print("Enriching NEGATIVES ..."); en = enrich_flood(neg); en["label"] = 0
        data = pd.concat([ep, en], ignore_index=True).dropna(subset=FEATURES)
        source = (f"{src_name} (positives) + matched controls; features from "
                  "Open-Meteo (ERA5 rainfall/soil, elevation->slope)")

    data.to_csv(os.path.join(OUT_DIR, "flood_training_data.csv"), index=False)
    bundle, metrics = train(data, source)
    joblib.dump(bundle, os.path.join(OUT_DIR, "flood_model.pkl"))
    with open(os.path.join(OUT_DIR, "flood_metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)
    print("\n===== FLOOD TRAINING COMPLETE =====")
    print(f"samples {metrics['n_samples']} (+{metrics['n_positive']}/-{metrics['n_negative']}) | best {metrics['best_model']}")
    for k, m in metrics["models"].items():
        print(f"  {k:14s} AUC={m['roc_auc']} acc={m['accuracy']} P={m['precision']} R={m['recall']} F1={m['f1']}")


if __name__ == "__main__":
    main()
