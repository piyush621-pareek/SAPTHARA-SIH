# SAPTHARA — AI-Powered Smart Logistics for NER Disaster Management

**SIH 2026 · Problem Statement ID: SIH26002 · Transportation & Logistics**

> *"Google Maps tells you where to go. SAPTHARA tells the government where help is needed, gets supplies there, and proves it happened — even without internet."*

SAPTHARA is a full-stack disaster logistics platform built for India's **North East Region (NER)** — the most flood/landslide-prone, connectivity-limited region in the country. It combines **ISRO satellite data**, **hazard-aware routing**, **offline-first mobile operations**, **BLE mesh SOS**, and a **tamper-proof audit trail** to solve the problem of delivering relief supplies when roads are destroyed and networks are down.

---

## Why Not Google Maps?

| Capability | Google Maps | SAPTHARA |
|---|---|---|
| Works without internet | View-only cached tiles | Full operations: reports, SOS, sync queue |
| Knows a road is destroyed | No (uses old traffic data) | Yes — field reports + MOSDAC satellite rainfall |
| Reroutes around hazards | No hazard awareness | Dijkstra on PostGIS road graph with hazard penalty |
| SOS without network | Impossible | BLE mesh relays SOS phone-to-phone |
| Supply chain tracking | None | Fleet tracking + delivery status per district |
| Accountability | None | Tamper-proof SHA-256 hash-chain ledger |
| NER village search | Missing most villages | ISRO Bhuvan census-linked geocoding |
| Satellite weather data | None | Real INSAT-3DR rainfall from MOSDAC |

---

## Architecture

```
INSAT-3DR satellite ──→ GeoTIFF ──→ ingest_mosdac.py ──→ PostGIS
                                                              │
Flutter App (offline) ──→ queue locally ──→ sync ──→ POST /reports ──→ ledger hash
                                                                           │
Dashboard ←── Socket.IO ←── emergency:alert ←── POST /emergency ←── SMS gateway ←── 2G SMS
                                                                           │
                                                        Twilio SMS ──→ responder phones

Driver requests route ──→ POST /routing/route ──→ Dijkstra(road graph ⊕ hazard zones)
                        ──→ GET /routing/bhuvan ──→ ISRO satellite route

No network? ──→ BLE Mesh (Nearby Connections) ──→ SOS hops phone-to-phone
             ──→ Fleet vehicle passes ──→ collects data via BLE ──→ uploads at next town (DTN)
```

---

## Tech Stack

### Backend (`node-api/`)
| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript |
| Framework | Express.js (versioned API: `/api/v1/*`) |
| Database | PostgreSQL + PostGIS (spatial queries, raster storage) |
| Cache / Pub-Sub | Redis (session cache + Socket.IO multi-replica fanout) |
| Real-time | Socket.IO with Redis adapter |
| Auth | JWT (15min access + 7-day revocable refresh tokens) |
| SMS Alerts | Twilio Verify API / custom webhook gateway |
| Validation | Zod schemas |
| Security | Helmet, CORS, rate limiting (600/min API, 6000/min telemetry) |

### Flutter Mobile App (`saptahara_frontend/saptahara/`)
| Layer | Technology |
|---|---|
| Framework | Flutter (Dart) |
| State Management | Riverpod (StateNotifier + Provider) |
| Maps | flutter_map + OpenStreetMap tiles |
| Networking | Dio HTTP + socket_io_client |
| Offline Sync | Local queue with retry tracking |
| BLE Mesh | Google Nearby Connections API (P2P_CLUSTER) |
| Push Notifications | Firebase Cloud Messaging + flutter_local_notifications |
| Languages | English, Hindi, Assamese, Bengali |

### Web Dashboard (`dashboard-dev/`)
| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Maps | Leaflet + react-leaflet |
| Real-time | Socket.IO client |
| Charts | Recharts |
| i18n | English, Hindi, Assamese |

---

## Key Features

### 1. Hazard-Aware Routing Engine
- PostGIS road graph with real NER road network
- Dijkstra's algorithm with two cost models: naive (fastest) vs safe (hazard-avoiding, 1000x penalty)
- Returns both alternatives so dispatchers can compare safety score vs distance
- ISRO Bhuvan satellite routing as a third option (same-state shortest path)

### 2. ISRO/MOSDAC Satellite Integration
- **MOSDAC INSAT-3DR**: Real satellite GeoTIFF rainfall data ingested into PostGIS via Python script
- **Bhuvan Routing API**: Shortest road path from ISRO's road network
- **Bhuvan Village Geocoding**: Census-linked village search with lat/lng, district, state, population
- **Bhuvan WMS**: Landslide susceptibility layers
- **CartoDEM**: Cartosat-1 elevation data for slope calculation

### 3. 2G SMS Emergency System
- Works over 2G SMS when internet is down
- Two compact wire formats: pipe frame (`vehicleId|lat|lng|HELP`) and JSON frame
- Base64-encoded for SMS transport efficiency
- Triggers: persist incident → spatial hazard check → Socket.IO broadcast → Twilio SMS to responders → ledger entry

### 4. BLE Mesh SOS (No Internet Required)
- Google Nearby Connections API (P2P_CLUSTER strategy)
- Each phone simultaneously advertises + discovers
- SOS alerts sent as JSON byte payloads, relayed across mesh with hop counting
- Queued alerts delivered when new peers connect

### 5. Tamper-Proof Audit Ledger
- SHA-256 hash chain — each entry includes the hash of the previous entry
- Canonical JSON serialization (sorted keys) for deterministic hashing
- Any retroactive edit breaks the chain and is detectable via `GET /ledger/verify`
- Every field report sync, SOS distress, and delivery completion is recorded

### 6. Offline-First Mobile Operations
- Field officers create geotagged reports offline (photo, GPS, hazard type, urgency)
- Reports queued locally with status tracking (pending/syncing/synced/failed)
- Auto-sync with retry when connectivity returns
- DTN (Delay Tolerant Networking): fleet vehicles collect queued data via Bluetooth from cut-off areas

### 7. Real-Time Dashboard
- Live fleet tracking on Leaflet map
- Socket.IO events: emergency alerts, hazard breaches, fleet updates, delivery status
- MOSDAC satellite overlay (rainfall intensity color-coded)
- Route planner with hazard-aware + Bhuvan options
- Ledger verification panel

---

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/auth/login` | JWT login with phone + OTP (Twilio Verify) |
| POST | `/api/v1/auth/refresh` | Rotate access token |
| POST | `/api/v1/telemetry/batch` | Bulk GPS sync from fleet (idempotent, dedup) |
| POST | `/api/v1/routing/route` | Hazard-aware routing (Dijkstra + PostGIS) |
| GET | `/api/v1/routing/bhuvan` | ISRO Bhuvan satellite routing |
| GET | `/api/v1/hazards` | Active hazard zones (GeoJSON polygons) |
| POST | `/api/v1/emergency/sms` | 2G SMS SOS webhook → broadcast + Twilio |
| POST | `/api/v1/reports` | Field report upload → ledger hash receipt |
| GET | `/api/v1/ledger/verify` | Verify hash-chain integrity |
| GET | `/api/v1/geo/village` | ISRO Bhuvan village geocoding |
| GET | `/api/v1/fleet` | Fleet vehicles with last-known positions |
| GET | `/api/v1/trips` | Supply delivery trips with waypoints |
| GET | `/api/v1/app/version` | APK update check (mobile polls on launch) |

---

## Socket.IO Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `emergency:alert` | Server → Client | SOS distress signal from field |
| `hazard:breach` | Server → Client | Vehicle entered a hazard zone |
| `fleet:update` | Server → Client | Vehicle position/speed update |
| `delivery:update` | Server → Client | Supply delivery status change |
| `connectivity:update` | Server → Client | Road/district connectivity change |
| `subscribe:region` | Client → Server | Subscribe to a specific NER region |

---

## Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ with PostGIS extension
- Redis 7+
- Flutter 3.x (for mobile app)
- Python 3.9+ (for MOSDAC data ingestion)

### Backend

```bash
cd node-api
cp .env.example .env    # Configure your tokens
npm install
npm run dev             # Starts on :8080
```

### Docker (Full Stack)

```bash
docker compose up --build
```
- API: http://localhost:8080 (health: `/api/v1/health`)
- PostGIS: `localhost:5432`
- Redis: `localhost:6379`

### Flutter App

```bash
cd saptahara_frontend/saptahara
flutter pub get
flutter run                    # Debug
flutter build apk --release    # Release APK
```

### Dashboard

```bash
cd dashboard-dev
npm install
npm run dev    # Starts on :5173
```

### MOSDAC Satellite Data Ingestion

```bash
cd node-api
pip install psycopg2-binary numpy
python scripts/ingest_mosdac.py
```

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | JWT signing secret |
| `BHUVAN_ROUTING_TOKEN` | ISRO Bhuvan routing API token |
| `BHUVAN_GEOCODING_TOKEN` | ISRO Bhuvan village geocoding token |
| `MOSDAC_TOKEN` | MOSDAC satellite data API token |
| `TWILIO_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_VERIFY_SERVICE_SID` | Twilio Verify service for OTP |
| `TWILIO_FROM` | Twilio sender phone number |
| `RESPONDER_NUMBERS` | Comma-separated responder phone numbers |

---

## Project Structure

```
SAPTHARA-SIH/
├── node-api/                    # Backend (Node.js + TypeScript)
│   ├── src/
│   │   ├── config/              # DB, Redis, Socket.IO, env
│   │   ├── controllers/         # Route handlers
│   │   ├── middleware/           # Auth, validation, error handling
│   │   ├── repositories/        # PostgreSQL/PostGIS queries
│   │   ├── routes/              # Express route definitions
│   │   ├── schemas/             # Zod validation schemas
│   │   ├── services/            # Business logic
│   │   │   └── isro/            # Bhuvan, MOSDAC, CartoDEM clients
│   │   └── utils/               # Dijkstra, hash chain, auth helpers
│   ├── migrations/              # SQL migration files
│   ├── scripts/                 # MOSDAC ingestion script
│   └── init-db.sql              # Database schema + seed data
│
├── saptahara_frontend/saptahara/  # Flutter mobile app
│   └── lib/
│       ├── app/                 # Providers (Riverpod)
│       ├── core/                # Theme, i18n, network, utils
│       ├── data/                # API repositories
│       ├── domain/              # Entities, repository interfaces
│       ├── presentation/        # Screens (home, mesh, sync, route, etc.)
│       └── services/            # Socket.IO, BLE mesh, push notifications
│
├── dashboard-dev/               # React web dashboard
│   └── src/
│       ├── components/          # FleetMap, RoutePlanner, AlertsFeed, etc.
│       └── *.ts                 # API, auth, socket, i18n, types
│
├── ai-service/                  # FastAPI ML service (landslide risk)
├── docker-compose.yml           # Full stack orchestration
└── init-db.sql                  # PostGIS schema
```

---

## NER Context

The North East Region of India has:
- **Single-road connectivity** — most districts have one NH link; if it's blocked, the district is isolated
- **Siliguri Corridor** — the entire NER connects to mainland India through a 22km wide corridor
- **Extreme rainfall** — Cherrapunji/Mawsynram receive 11,000+ mm/year
- **Annual floods and landslides** — destroying roads and cutting off communities for days/weeks
- **Limited cellular coverage** — many areas lose network during disasters

SAPTHARA is built specifically for these constraints.

---

## Team

Built for **Smart India Hackathon 2026** — Problem Statement SIH26002

**Ministry:** MDoNER (Ministry of Development of North Eastern Region)

---

## License

This project is developed as part of SIH 2026. All rights reserved.
