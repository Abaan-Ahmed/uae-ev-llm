import requests
import json

API_KEY = "6b0eea1a-6d8e-43c6-bb23-cf2da60eaf02"

API_URL = "https://api.openchargemap.io/v3/poi"

params = {
    "output": "json",
    "countrycode": "AE",
    "maxresults": 200,
    "key": API_KEY,
    "verbose": True,          # include full connection info
    "includecomments": False,
}

headers = {
    "User-Agent": "uae-ev-llm-project"
}

# Open Charge Map level IDs: 1=L1, 2=L2, 3=DC Fast
LEVEL_NAMES = {1: "AC Standard", 2: "AC Fast", 3: "DC Fast"}

# Open Charge Map connection type IDs for common connectors
CONNECTOR_NAMES = {
    1: "Type 1 (J1772)", 2: "CHAdeMO", 25: "Type 2", 32: "CCS1",
    33: "CCS2", 27: "Tesla (CCS2)", 8: "Tesla (Proprietary)"
}

response = requests.get(API_URL, params=params, headers=headers)

if response.status_code != 200:
    print("API request failed:", response.status_code)
    print(response.text)
    exit()

data = response.json()

chargers = []

for station in data:
    try:
        addr = station["AddressInfo"]

        # Collect connector / level info from all connections
        connections = station.get("Connections") or []
        connectors = []
        power_kw = 0
        charger_level = 2
        is_fast = False
        num_connectors = len(connections)

        for conn in connections:
            # Connector type name
            ct = conn.get("ConnectionType") or {}
            ct_id = ct.get("ID")
            ct_name = CONNECTOR_NAMES.get(ct_id, ct.get("Title", "Unknown"))
            if ct_name not in connectors:
                connectors.append(ct_name)

            # Power
            kw = conn.get("PowerKW") or 0
            if kw > power_kw:
                power_kw = kw

            # Level
            lvl = conn.get("Level") or {}
            lvl_id = lvl.get("ID", 2)
            if lvl_id == 3:
                is_fast = True
                charger_level = 3
            elif lvl_id == 2 and charger_level < 3:
                charger_level = 2

        charger_type = LEVEL_NAMES.get(charger_level, "AC Fast")

        # Operator
        op = station.get("OperatorInfo") or {}
        operator = op.get("Title", "Unknown")

        chargers.append({
            "name": addr["Title"],
            "lat": addr["Latitude"],
            "lng": addr["Longitude"],
            "city": addr.get("Town") or addr.get("StateOrProvince") or "UAE",
            "charger_type": charger_type,
            "level": charger_level,
            "power_kw": round(power_kw, 1),
            "connectors": connectors or ["Type 2"],
            "num_connectors": num_connectors or 1,
            "operator": operator,
            "is_fast_charger": is_fast,
        })

    except Exception as e:
        print(f"Skipping station: {e}")
        continue

with open("uae_ev_chargers.json", "w") as f:
    json.dump(chargers, f, indent=2)

print(f"Downloaded {len(chargers)} UAE EV chargers with full metadata")