"""
Generates realistic synthetic airfare observation data and loads it into SQLite.
Run standalone: python seed_data.py
"""
import sqlite3
import random
import math
from datetime import datetime, timedelta

random.seed(42)

DB_PATH = "vayu-astra.db"

ROUTES = [
    ("DEL", "BOM", "Delhi", "Mumbai", 5200),
    ("DEL", "BLR", "Delhi", "Bengaluru", 5800),
    ("BOM", "BLR", "Mumbai", "Bengaluru", 4100),
    ("DEL", "HYD", "Delhi", "Hyderabad", 4700),
    ("DEL", "CCU", "Delhi", "Kolkata", 4300),
    ("BOM", "HYD", "Mumbai", "Hyderabad", 3900),
    ("BLR", "HYD", "Bengaluru", "Hyderabad", 3200),
    ("DEL", "MAA", "Delhi", "Chennai", 5100),
    ("BOM", "MAA", "Mumbai", "Chennai", 4600),
    ("DEL", "GOI", "Delhi", "Goa", 4900),
    ("BOM", "GOI", "Mumbai", "Goa", 3100),
    ("BLR", "MAA", "Bengaluru", "Chennai", 2600),
    ("DEL", "PNQ", "Delhi", "Pune", 4800),
    ("BOM", "PNQ", "Mumbai", "Pune", 2200),
    ("DEL", "AMD", "Delhi", "Ahmedabad", 4400),
]

AIRLINES = ["IndiGo", "Air India", "Vistara", "SpiceJet", "Akasa Air"]
SOURCES = ["Source A", "Source B", "Source C"]

DAYS_OF_HISTORY = 90


def build_schema(conn):
    conn.executescript(
        """
        DROP TABLE IF EXISTS fare_observations;
        CREATE TABLE fare_observations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            origin TEXT,
            destination TEXT,
            origin_city TEXT,
            destination_city TEXT,
            airline TEXT,
            fare REAL,
            observed_at TEXT,
            source TEXT
        );
        CREATE INDEX idx_route ON fare_observations(origin, destination);
        CREATE INDEX idx_date ON fare_observations(observed_at);
        """
    )


def generate_series(base_fare, days):
    """Generate a fare time series with trend, weekly seasonality, and noise.
    Occasionally injects an anomaly spike so the anomaly engine has something to find.
    """
    series = []
    trend = random.uniform(-0.15, 0.35)  # overall drift over the period, as fraction
    anomaly_day = random.randint(10, days - 5) if random.random() < 0.4 else None
    for day in range(days):
        t = day / days
        seasonal = 1 + 0.08 * math.sin(2 * math.pi * (day % 7) / 7)  # weekly pattern
        drift = 1 + trend * t
        noise = random.gauss(0, 0.04)
        multiplier = seasonal * drift * (1 + noise)
        if anomaly_day is not None and day == anomaly_day:
            multiplier *= random.uniform(1.25, 1.45)  # spike
        fare = max(1500, base_fare * multiplier)
        series.append(round(fare, 2))
    return series


def seed():
    conn = sqlite3.connect(DB_PATH)
    build_schema(conn)
    cur = conn.cursor()

    start_date = datetime.now() - timedelta(days=DAYS_OF_HISTORY)
    rows = []

    for origin, dest, origin_city, dest_city, base_fare in ROUTES:
        series = generate_series(base_fare, DAYS_OF_HISTORY)
        for day_idx, fare in enumerate(series):
            observed_at = (start_date + timedelta(days=day_idx)).isoformat()
            # 1-3 observations per day from different sources/airlines
            for _ in range(random.randint(1, 3)):
                airline = random.choice(AIRLINES)
                source = random.choice(SOURCES)
                jitter = fare * random.uniform(-0.03, 0.03)
                rows.append(
                    (
                        origin,
                        dest,
                        origin_city,
                        dest_city,
                        airline,
                        round(fare + jitter, 2),
                        observed_at,
                        source,
                    )
                )

    cur.executemany(
        """
        INSERT INTO fare_observations
        (origin, destination, origin_city, destination_city, airline, fare, observed_at, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )
    conn.commit()
    print(f"Seeded {len(rows)} fare observations across {len(ROUTES)} routes.")
    conn.close()


if __name__ == "__main__":
    seed()
