"""
Congestion Risk Model — Real-Data Training (SIH26002)
=====================================================
Trains the congestion-risk classifier on the REAL UCI "Metro Interstate Traffic
Volume" dataset (~48k hourly records of measured traffic volume with weather +
timestamps). We predict whether an hour is congested (top-tertile traffic
volume) from features available at inference time in our platform:

    hour of day, day of week, weekend flag, and rainfall.

At serving time the backend feeds the current time + live rainfall to this model
for a baseline congestion probability, then blends it with live fleet telemetry
(vehicle density + speed). Output: model/congestion_model.pkl + metrics.

Usage:  python train_congestion.py
"""
from __future__ import annotations

import io
import json
import os
import urllib.request
from datetime import datetime

import numpy as np
import pandas as pd
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
OUT_DIR = os.path.join(HERE, "model")
DATA = os.path.join(HERE, "data", "metro_traffic.csv.gz")
URL = "https://archive.ics.uci.edu/ml/machine-learning-databases/00492/Metro_Interstate_Traffic_Volume.csv.gz"

FEATURES = ["hour", "day_of_week", "is_weekend", "rain_mm"]


def load() -> pd.DataFrame:
    if not os.path.exists(DATA):
        os.makedirs(os.path.dirname(DATA), exist_ok=True)
        print("Downloading UCI Metro Interstate Traffic Volume ...", flush=True)
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r:
            open(DATA, "wb").write(r.read())
    df = pd.read_csv(DATA, compression="gzip")
    df["date_time"] = pd.to_datetime(df["date_time"])
    df["hour"] = df["date_time"].dt.hour
    df["day_of_week"] = df["date_time"].dt.dayofweek
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)
    df["rain_mm"] = df["rain_1h"].clip(0, 50)  # a few sensor spikes exist
    # Congested = top-tertile traffic volume (real measured congestion).
    thr = df["traffic_volume"].quantile(0.66)
    df["label"] = (df["traffic_volume"] >= thr).astype(int)
    return df[FEATURES + ["label"]].dropna()


def train(df: pd.DataFrame):
    X = df[FEATURES].to_numpy(float)
    y = df["label"].to_numpy(int)
    medians = {f: float(np.nanmedian(df[f])) for f in FEATURES}
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)
    scaler = StandardScaler().fit(Xtr)
    Xtr_s, Xte_s = scaler.transform(Xtr), scaler.transform(Xte)
    cands = {
        "logreg": LogisticRegression(max_iter=1000, class_weight="balanced"),
        "random_forest": RandomForestClassifier(n_estimators=200, max_depth=12, random_state=42),
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
        if name == "random_forest":
            report[name]["feature_importance"] = dict(zip(FEATURES, [round(v, 4) for v in clf.feature_importances_]))
        if auc > best_auc:
            best_auc, best, best_model = auc, name, clf
    metrics = {
        "trained_at": datetime.now().isoformat() + "Z",
        "data_source": "UCI Metro Interstate Traffic Volume (~48k real hourly records)",
        "n_samples": int(len(df)), "n_positive": int(y.sum()), "n_negative": int((y == 0).sum()),
        "features": FEATURES, "feature_medians": medians, "best_model": best, "models": report,
    }
    bundle = {"model": best_model, "scaler": scaler, "model_type": best, "features": FEATURES,
              "feature_medians": medians, "trained_at": metrics["trained_at"],
              "data_source": metrics["data_source"]}
    return bundle, metrics


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    df = load()
    print(f"[real] {len(df)} hourly records")
    bundle, metrics = train(df)
    joblib.dump(bundle, os.path.join(OUT_DIR, "congestion_model.pkl"))
    with open(os.path.join(OUT_DIR, "congestion_metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)
    print("\n===== CONGESTION TRAINING COMPLETE =====")
    print(f"samples {metrics['n_samples']} | best {metrics['best_model']}")
    for k, m in metrics["models"].items():
        print(f"  {k:14s} AUC={m['roc_auc']} acc={m['accuracy']} P={m['precision']} R={m['recall']} F1={m['f1']}")


if __name__ == "__main__":
    main()
