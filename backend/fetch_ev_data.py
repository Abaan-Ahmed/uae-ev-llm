"""
fetch_ev_data.py
~~~~~~~~~~~~~~~~
Downloads UAE EV charger data from Open Charge Map and saves it as
uae_ev_chargers.json with full metadata (type, power, connectors, operator).

Usage:
    python fetch_ev_data.py
"""
import json
import sys
from math import radians, sin, cos, sqrt, atan2
from pathlib import Path

import requests

API_KEY = "6b0eea1a-6d8e-43c6-bb23-cf2da60eaf02"
API_URL = "https://api.openchargemap.io/v3/poi"

PARAMS = {
    "output":        "json",
    "countrycode":   "AE",
    "maxresults":    200,
    "key":           API_KEY,
    "verbose":       True,
    "includecomments": False,
}
HEADERS = {"User-Agent": "uae-ev-llm-project"}

# Open Charge Map level IDs
LEVEL_NAMES = {1: "AC Standard", 2: "AC Fast", 3: "DC Fast"}

# Common connector type IDs
CONNECTOR_NAMES = {
    1:  "Type 1 (J1772)",
    2:  "CHAdeMO",
    25: "Type 2",
    32: "CCS1",
    33: "CCS2",
    27: "Tesla (CCS2)",
    8:  "Tesla (Proprietary)",
}

# City center coordinates for nearest-center city assignment
CITY_CENTERS = [
    ("Dubai",         25.2048, 55.2708),
    ("Abu Dhabi",     24.4539, 54.3773),
    ("Sharjah",       25.3463, 55.4209),
    ("Ajman",         25.4052, 55.5136),
    ("Ras Al Khaimah",25.7895, 55.9432),
    ("Fujairah",      25.1288, 56.3265),
    ("Al Ain",        24.2075, 55.7447),
    ("Umm Al Quwain", 25.5641, 55.5556),
]


def _haversine(lat1, lng1, lat2, lng2) -> float:
    R = 6371
    dlat, dlng = radians(lat2 - lat1), radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def infer_city(lat: float, lng: float) -> str:
    """Assign city by finding the nearest city center — no bounding boxes."""
    return min(CITY_CENTERS, key=lambda c: _haversine(lat, lng, c[1], c[2]))[0]


def fetch_and_save(out_path: Path) -> int:
    print("Fetching from Open Charge Map…")
    try:
        resp = requests.get(API_URL, params=PARAMS, headers=HEADERS, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

    raw = resp.json()
    chargers = []

    for station in raw:
        try:
            addr = station["AddressInfo"]

            connections = station.get("Connections") or []
            connectors: list[str] = []
            power_kw   = 0.0
            charger_level = 2
            is_fast    = False

            for conn in connections:
                ct     = conn.get("ConnectionType") or {}
                ct_id  = ct.get("ID")
                ct_name = CONNECTOR_NAMES.get(ct_id, ct.get("Title", "Unknown"))
                if ct_name not in connectors:
                    connectors.append(ct_name)

                kw = conn.get("PowerKW") or 0
                if kw > power_kw:
                    power_kw = float(kw)

                lvl    = conn.get("Level") or {}
                lvl_id = lvl.get("ID", 2)
                if lvl_id == 3:
                    is_fast = True
                    charger_level = 3
                elif lvl_id == 2 and charger_level < 3:
                    charger_level = 2

            charger_type = LEVEL_NAMES.get(charger_level, "AC Fast")

            op       = station.get("OperatorInfo") or {}
            operator = op.get("Title", "Unknown")

            lat = addr["Latitude"]
            lng = addr["Longitude"]

            chargers.append({
                "name":          addr["Title"],
                "lat":           lat,
                "lng":           lng,
                "city":          infer_city(lat, lng),
                "charger_type":  charger_type,
                "level":         charger_level,
                "power_kw":      round(power_kw, 1),
                "connectors":    connectors or ["Type 2"],
                "num_connectors": len(connections) or 1,
                "operator":      operator,
                "is_fast_charger": is_fast,
            })
        except Exception as e:
            print(f"  Skipping station: {e}")

    out_path.write_text(json.dumps(chargers, indent=2))
    return len(chargers)


if __name__ == "__main__":
    out = Path(__file__).parent / "uae_ev_chargers.json"
    n   = fetch_and_save(out)
    print(f"Saved {n} UAE EV chargers → {out}")
