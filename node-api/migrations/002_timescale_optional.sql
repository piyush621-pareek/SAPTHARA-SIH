-- Optional scale hook: enable TimescaleDB only if the running Postgres image
-- ships it (a no-op on the plain postgis image). Converting `telemetry` into a
-- hypertable additionally requires dropping the id primary key so the unique
-- key includes the partition column (timestamp) — see docs/SCALING.md. Left as
-- a guarded extension-create here so switching to a TimescaleDB image is a
-- one-line change with no code impact.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb') THEN
    CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
    RAISE NOTICE 'TimescaleDB available and enabled; convert telemetry to a hypertable per docs/SCALING.md';
  END IF;
END$$;
