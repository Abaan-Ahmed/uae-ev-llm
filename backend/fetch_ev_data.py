import requests
import json

API_KEY = "6b0eea1a-6d8e-43c6-bb23-cf2da60eaf02"

API_URL = "https://api.openchargemap.io/v3/poi"

params = {
    "output": "json",
    "countrycode": "AE",
    "maxresults": 200,
    "key": API_KEY
}

headers = {
    "User-Agent": "uae-ev-llm-project"
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
        chargers.append({
            "name": station["AddressInfo"]["Title"],
            "lat": station["AddressInfo"]["Latitude"],
            "lng": station["AddressInfo"]["Longitude"]
        })
    except:
        continue

with open("uae_ev_chargers.json", "w") as f:
    json.dump(chargers, f, indent=2)

print("Downloaded", len(chargers), "UAE EV chargers")