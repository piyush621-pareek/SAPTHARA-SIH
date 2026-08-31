# Scaling & Ops Notes (NER Backend)

These are the paths for taking the prototype to fleet scale. The code is
structured so each is an additive change, not a rewrite.

## 1. Telemetry at scale — TimescaleDB hypertable
The `telemetry` table is the write-hot path. To partition it by time:

1. Switch the DB image in `docker-compose.yml` to one that bundles both PostGIS
   and TimescaleDB, e.g. `timescale/timescaledb-ha:pg16`.
2. Migration `002_timescale_optional.sql` already enables the extension when
   present. Then convert the table (one-time), noting that a hypertable's unique
   indexes must include the partition column:
   ```sql
   ALTER TABLE telemetry DROP CONSTRAINT telemetry_pkey;             -- id-only PK
   ALTER TABLE telemetry ADD PRIMARY KEY (id, "timestamp");          -- include time
   SELECT create_hypertable('telemetry', 'timestamp', migrate_data => true);
   ```
3. Add a retention/compression policy (`add_retention_policy`,
   `add_compression_policy`).

## 2. Ingest buffering — message queue
For thousands of devices flushing offline buffers at once, put a queue in front
of the DB:
- Producer: `POST /telemetry/batch` enqueues to Kafka/Redis Streams instead of
  inserting directly.
- Consumer: a worker drains the queue and does the `ON CONFLICT` bulk insert.
The dedup guarantee is unchanged (still enforced by the DB unique constraint).

## 3. Routing at city scale — full OSM + pgRouting
The reroute engine currently uses a curated NER corridor graph. To route on any
road:
1. Add the `pgrouting` extension (use a `pgrouting/pgrouting` image or install
   `postgresql-16-pgrouting`).
2. Import an OSM extract of the NER with `osm2pgrouting` into `ways` /
   `ways_vertices_pgr`.
3. Replace the in-app Dijkstra with `pgr_dijkstra` / `pgr_aStar`, keeping the
   same hazard-aware edge-cost SQL (`ST_Intersects` against active hazards).

## 4. Observability
Add structured logging (pino), request tracing, Prometheus metrics, and a
readiness probe that also checks the AI service dependency.

## 5. CI/CD
`.github/workflows/ci.yml` builds + tests the backend and analyzes both Flutter
apps on every push/PR. Extend with a deploy job (build & push Docker images).
