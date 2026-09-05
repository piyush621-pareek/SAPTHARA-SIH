"""
MOSDAC Satellite Data Ingestion Pipeline
=========================================
Ingests INSAT-3DR GeoTIFF products into PostGIS raster tables so the
backend can query real satellite rainfall/humidity at any lat/lng.

Products handled:
  - 3RIMG_L3G_IMR_DLY  → daily accumulated rainfall (mm/day)
  - 3RIMG_L2B_HEM      → half-hourly humidity/evaporation

Usage:
  python scripts/ingest_mosdac.py                       # ingest all
  python scripts/ingest_mosdac.py --product rainfall    # rainfall only
  python scripts/ingest_mosdac.py --product humidity    # humidity only

Requires: pip install rasterio psycopg2-binary numpy
"""

import argparse
import glob
import os
import re
import struct
import sys
from datetime import datetime

import numpy as np
import psycopg2
import rasterio

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgres://ner_admin:ner_secret_2026@localhost:5432/ner_logistics",
)

RAINFALL_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "3RIMG_L3G_IMR_DLY")
HUMIDITY_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "3RIMG_L2B_HEM")


def parse_date_from_filename(fname: str) -> datetime | None:
    m = re.search(r"(\d{2})([A-Z]{3})(\d{4})_(\d{4})", fname)
    if not m:
        return None
    day, mon, year, hhmm = m.groups()
    try:
        return datetime.strptime(f"{day}{mon}{year} {hhmm}", "%d%b%Y %H%M")
    except ValueError:
        return None


def ensure_tables(conn):
    with conn.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
        cur.execute("CREATE EXTENSION IF NOT EXISTS postgis_raster;")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS mosdac_rainfall (
                id SERIAL PRIMARY KEY,
                observed_at TIMESTAMPTZ NOT NULL,
                filename TEXT NOT NULL,
                bbox GEOMETRY(Polygon, 4326),
                width INT,
                height INT,
                pixel_size DOUBLE PRECISION,
                nodata DOUBLE PRECISION,
                min_val DOUBLE PRECISION,
                max_val DOUBLE PRECISION,
                mean_val DOUBLE PRECISION,
                data BYTEA NOT NULL,
                ingested_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(filename)
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS mosdac_humidity (
                id SERIAL PRIMARY KEY,
                observed_at TIMESTAMPTZ NOT NULL,
                filename TEXT NOT NULL,
                bbox GEOMETRY(Polygon, 4326),
                width INT,
                height INT,
                pixel_size DOUBLE PRECISION,
                nodata DOUBLE PRECISION,
                min_val DOUBLE PRECISION,
                max_val DOUBLE PRECISION,
                mean_val DOUBLE PRECISION,
                data BYTEA NOT NULL,
                ingested_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(filename)
            );
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_mosdac_rainfall_time
            ON mosdac_rainfall (observed_at DESC);
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_mosdac_humidity_time
            ON mosdac_humidity (observed_at DESC);
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_mosdac_rainfall_bbox
            ON mosdac_rainfall USING GIST (bbox);
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_mosdac_humidity_bbox
            ON mosdac_humidity USING GIST (bbox);
        """)
    conn.commit()


def ingest_tiff(conn, filepath: str, table: str):
    fname = os.path.basename(filepath)
    obs_time = parse_date_from_filename(fname)
    if not obs_time:
        print(f"  SKIP (can't parse date): {fname}")
        return False

    with conn.cursor() as cur:
        cur.execute(f"SELECT 1 FROM {table} WHERE filename = %s", (fname,))
        if cur.fetchone():
            print(f"  SKIP (already ingested): {fname}")
            return False

    with rasterio.open(filepath) as ds:
        data = ds.read(1).astype(np.float32)
        nodata = ds.nodata if ds.nodata is not None else -999.0
        bounds = ds.bounds
        width = ds.width
        height = ds.height
        pixel_size = abs(ds.transform.a)

        valid = data[data != nodata]
        min_val = float(valid.min()) if len(valid) > 0 else 0.0
        max_val = float(valid.max()) if len(valid) > 0 else 0.0
        mean_val = float(valid.mean()) if len(valid) > 0 else 0.0

        bbox_wkt = (
            f"POLYGON(({bounds.left} {bounds.bottom}, {bounds.right} {bounds.bottom}, "
            f"{bounds.right} {bounds.top}, {bounds.left} {bounds.top}, "
            f"{bounds.left} {bounds.bottom}))"
        )

        data_bytes = data.tobytes()

    with conn.cursor() as cur:
        cur.execute(
            f"""
            INSERT INTO {table}
                (observed_at, filename, bbox, width, height, pixel_size,
                 nodata, min_val, max_val, mean_val, data)
            VALUES (%s, %s, ST_GeomFromText(%s, 4326), %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                obs_time, fname, bbox_wkt, width, height, pixel_size,
                nodata, min_val, max_val, mean_val,
                psycopg2.Binary(data_bytes),
            ),
        )
    conn.commit()
    print(f"  OK: {fname} — {obs_time.isoformat()}, mean={mean_val:.1f}, max={max_val:.1f}")
    return True


def ingest_directory(conn, directory: str, table: str):
    tiffs = sorted(glob.glob(os.path.join(directory, "*.tif")))
    if not tiffs:
        print(f"  No .tif files found in {directory}")
        return 0
    count = 0
    for f in tiffs:
        if ingest_tiff(conn, f, table):
            count += 1
    return count


def create_query_function(conn):
    """Create a SQL function for point-based rainfall/humidity lookup."""
    with conn.cursor() as cur:
        cur.execute("""
            CREATE OR REPLACE FUNCTION mosdac_rainfall_at(
                p_lat DOUBLE PRECISION,
                p_lng DOUBLE PRECISION,
                p_hours_back INT DEFAULT 24
            ) RETURNS TABLE(
                observed_at TIMESTAMPTZ,
                rainfall_mm DOUBLE PRECISION
            ) AS $$
            DECLARE
                rec RECORD;
                px INT;
                py INT;
                offset_idx INT;
                raw_bytes BYTEA;
                val FLOAT;
            BEGIN
                FOR rec IN
                    SELECT r.observed_at AS obs, r.data, r.width, r.height,
                           r.pixel_size, r.nodata,
                           ST_XMin(r.bbox) AS xmin, ST_YMax(r.bbox) AS ymax
                    FROM mosdac_rainfall r
                    WHERE r.observed_at >= NOW() - (p_hours_back || ' hours')::INTERVAL
                      AND ST_Contains(r.bbox, ST_SetSRID(ST_Point(p_lng, p_lat), 4326))
                    ORDER BY r.observed_at DESC
                LOOP
                    px := FLOOR((p_lng - rec.xmin) / rec.pixel_size)::INT;
                    py := FLOOR((rec.ymax - p_lat) / rec.pixel_size)::INT;
                    IF px >= 0 AND px < rec.width AND py >= 0 AND py < rec.height THEN
                        offset_idx := (py * rec.width + px) * 4 + 1;
                        raw_bytes := substring(rec.data FROM offset_idx FOR 4);
                        IF length(raw_bytes) = 4 THEN
                            val := get_byte(raw_bytes, 0)::FLOAT / 1.0;
                            -- Decode IEEE 754 float32 (little-endian)
                            val := (
                                get_byte(raw_bytes, 0) +
                                get_byte(raw_bytes, 1) * 256 +
                                get_byte(raw_bytes, 2) * 65536 +
                                get_byte(raw_bytes, 3) * 16777216
                            )::BIT(32)::INT;
                            -- Use a simpler approach: return raw pixel lookup via app layer
                            observed_at := rec.obs;
                            rainfall_mm := -1; -- placeholder, real decode in app
                            RETURN NEXT;
                        END IF;
                    END IF;
                END LOOP;
            END;
            $$ LANGUAGE plpgsql;
        """)
    conn.commit()


def main():
    parser = argparse.ArgumentParser(description="Ingest MOSDAC satellite data into PostGIS")
    parser.add_argument("--product", choices=["rainfall", "humidity", "all"], default="all")
    args = parser.parse_args()

    print(f"Connecting to database...")
    conn = psycopg2.connect(DB_URL)
    print("Connected. Ensuring tables exist...")
    ensure_tables(conn)

    total = 0

    if args.product in ("rainfall", "all"):
        print(f"\n=== Ingesting RAINFALL (IMR_DLY) from {RAINFALL_DIR} ===")
        total += ingest_directory(conn, RAINFALL_DIR, "mosdac_rainfall")

    if args.product in ("humidity", "all"):
        print(f"\n=== Ingesting HUMIDITY (HEM) from {HUMIDITY_DIR} ===")
        total += ingest_directory(conn, HUMIDITY_DIR, "mosdac_humidity")

    print(f"\nDone. Ingested {total} new file(s).")
    conn.close()


if __name__ == "__main__":
    main()
