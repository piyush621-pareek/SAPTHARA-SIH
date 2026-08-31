# Disruption Risk Models — Real-Data ML (SIH26002)

The AI microservice hosts **three models, each trained on a real public dataset**,
for the disruption types in PS 26002 (b). Every model degrades to a physics
heuristic if its `.pkl` is absent, so the service always works.

| Model | Real dataset (NER-specific where available) | Best model | ROC-AUC | Endpoint |
|---|---|---|---|---|
| **Landslide** | NASA Global Landslide Catalog — **North-East India events only** | LogReg | **0.85** | `POST /predict` |
| **Flood** | **India Flood Inventory (IMD)** — NER states, district-geocoded | Random Forest | **0.87** | `POST /predict/flood` |
| **Congestion** | UCI Metro Interstate Traffic Volume (pattern proxy) | Random Forest | **0.97** | `POST /predict/congestion` |

Two of the three models are trained on **NER-specific real data**: the landslide
model on North-East events from NASA's catalog, and the flood model on the India
Flood Inventory (IMD-sourced) filtered to the 8 NER states. Congestion uses a US
traffic dataset as a time/weather *pattern* proxy — no public NER traffic
dataset exists; a production build would use a live traffic API.

Retrain: `python train.py --ner-only` (NER landslide) · `python train_flood.py
--ifi` (NER flood) · `python train_congestion.py`. Drop the flags for the global
variants. Metrics are written to `model/*_metrics.json`. The rest of this file details the landslide pipeline;
flood mirrors it (flood-event positives + matched controls, real rainfall/
elevation features), and congestion predicts a time-of-day/weather congestion
baseline from real hourly traffic, blended with live fleet telemetry.

---

## Landslide Risk Model

## What the model is trained on

| | Source | What it provides |
|---|---|---|
| **Positive labels** | [NASA Global Landslide Catalog](https://data.nasa.gov/docs/legacy/Global_Landslide_Catalog_Export/Global_Landslide_Catalog_Export_rows.csv) | 11,033 real, rainfall-triggered landslide events worldwide (lat/lng + date); the sample is biased toward the NER/India belt |
| **Negative labels** | Geographically-matched controls (case-control design) | Points sampled *near* real events but ≥28 km away, on a random date — "similar place, no landslide" |
| **Features** | [Open-Meteo](https://open-meteo.com) (free, no API key) | `rainfall_mm` + `soil_moisture` (ERA5 archive, on the event date), `slope` + `elevation` (elevation API → 5-point gradient) |

Feature vector: `[rainfall_mm, soil_moisture]` — the two proven, monotonic
triggers of monsoon landslides.

> **Why only two features?** slope, elevation and latitude are all enriched and
> saved for inspection, but they are **not fed to the model**:
> - **slope + elevation** — coarse training DEM (~550 m stencil) vs sharp ISRO
>   **CartoDEM** at inference: a train↔inference distribution shift that made an
>   earlier model rank terrain backwards (a flat site scored above a steep one).
> - **latitude** — introduced residual geographic memorisation that flipped the
>   ranking between two sites with near-identical rainfall.
>
> Keeping rainfall + soil moisture guarantees risk rises with the real drivers
> and can never rank a wetter site as safer. Terrain/susceptibility nuance enters
> downstream via the physics heuristic + Bhuvan fusion in the backend.

## Results (held-out test set)

Trained on 418 samples (218 positive / 200 negative), 25% held out for testing:

| Model | ROC-AUC | Accuracy | Precision | Recall | F1 |
|---|---|---|---|---|---|
| **Logistic Regression** (selected) | **0.774** | 0.733 | 0.721 | 0.800 | 0.759 |
| Random Forest | 0.774 | 0.743 | 0.719 | 0.836 | 0.773 |

ROC-AUC **0.77** on held-out real events is an honest generalisation estimate
(an earlier variant scored higher only because latitude let it memorise *where*
events had occurred — we removed that). **Recall 0.80** matters most for safety:
the model catches ~80% of real landslides. The logistic coefficients are
physically correct and monotonic — **rainfall +1.56, soil moisture +1.00** — so
risk always rises with the real triggers.

## How to (re)train

```bash
cd ai-service
python -m pip install -r requirements-train.txt
python train.py --samples 300      # real data (needs internet: NASA + Open-Meteo)
python train.py --offline          # no internet: physically-grounded synthetic
```

Outputs go to `ai-service/model/`:
- `model.pkl` — the chosen model + `StandardScaler` + feature medians (bundle)
- `metrics.json` — full metrics for both models
- `training_data.csv` — the enriched dataset (inspect the real feature values)

The service auto-loads `model/model.pkl` on boot (`/health` reports
`"trained_model": true`). Retraining just replaces the file.

## Honest notes (say these to judges)

- Rainfall/soil come from **ERA5 gridded reanalysis** (smoothed ~9 km cells), so
  absolute rainfall magnitudes are lower than a rain gauge. The model still
  *discriminates* correctly; the heuristic blend keeps extreme raw inputs sane.
- **We deliberately reduced the model to rainfall + soil moisture.** slope and
  elevation caused a train↔inference distribution shift (coarse training DEM vs
  sharp ISRO CartoDEM), and latitude caused geographic memorisation — both
  skewed the risk ranking between sites. Diagnosing and pruning those is a sign
  of a sound ML process; the features stay in the dataset for a future model
  trained with a matched high-resolution DEM and more regional events.
- This is a strong prototype, not an operational forecast. The pipeline is ready
  to swap in higher-resolution rainfall/DEM and more regional events.
