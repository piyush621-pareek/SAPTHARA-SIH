# AI-Based Smart Logistics & Accessibility Intelligence Platform — NER

**SIH26002 · Transportation & Logistics · Software**

Edge-first, spatially-aware backend for logistics across the 8 North Eastern
states. Predictive rerouting, resilient offline sync, multi-tiered emergency
fallback (2G SMS + BLE mesh), and PostGIS geofencing.

## Architecture

```
                    ┌─────────────────┐
  Edge devices ───▶ │  Node/Express   │ ──▶ PostgreSQL + PostGIS (spatial store)
  (2G SMS, BLE,     │  API  :8080     │ ──▶ Redis (cache + Socket.IO adapter)
   internet sync)   │  Socket.IO      │ ──▶ FastAPI AI :9000 (landslide risk)
                    └─────────────────┘
```

Pattern: **Controller → Service → Repository**, with Zod validation middleware
and a centralized async error handler.

## Run the whole stack

```bash
docker compose up --build
```

- API: http://localhost:8080  (health: `/api/v1/health`)
- AI service: http://localhost:9000/docs
- PostGIS: `localhost:5432`  ·  Redis: `localhost:6379`

`init-db.sql` runs automatically on first boot: enables `postgis`, creates all
tables, the compound unique constraint on `telemetry (vehicle_id, timestamp)`,
GiST spatial indexes, and seed data.

## Local dev (Node only)

```bash
cd node-api
cp .env.example .env
npm install
npm run dev
```

## Key endpoints

| Method | Path                       | Purpose |
|--------|----------------------------|---------|
| POST   | `/api/v1/telemetry/batch`  | Offline bulk sync — DB-native dedup via `ON CONFLICT DO NOTHING` |
| POST   | `/api/v1/telemetry/relay`  | BLE mesh relay packet (base64 frame) |
| POST   | `/api/v1/hazards`          | Register a hazard polygon |
| GET    | `/api/v1/hazards/nearby`   | Proximity search (`ST_DWithin`) |
| POST   | `/api/v1/hazards/contains` | Geofence collision (`ST_Contains`) |
| POST   | `/api/v1/hazards/risk`     | Predictive rerouting risk (calls AI service) |
| POST   | `/api/v1/emergency/sms`    | 2G SMS distress webhook → Socket.IO alert |
| POST   | `/predict` (AI :9000)      | Landslide risk score + recommended action |

## Example: batch telemetry (idempotent re-upload safe)

```bash
curl -X POST http://localhost:8080/api/v1/telemetry/batch \
  -H 'content-type: application/json' \
  -d '{"points":[{"vehicle_id":"<uuid>","timestamp":"2026-08-28T09:00:00Z","latitude":25.57,"longitude":91.88,"speed_kmph":32}]}'
```

## Example: landslide risk

```bash
curl -X POST http://localhost:9000/predict \
  -H 'content-type: application/json' \
  -d '{"latitude":25.57,"longitude":91.88,"rainfall_mm":180,"soil_moisture":0.85,"slope":38}'
```
