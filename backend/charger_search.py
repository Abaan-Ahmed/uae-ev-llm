import json
from distance import calculate_distance

# Load charger dataset

with open("uae_ev_chargers.json") as f:
    chargers = json.load(f)


def find_nearest_chargers(user_lat, user_lng, top_k=5):

    results = []

    for c in chargers:

        dist = calculate_distance(
            user_lat,
            user_lng,
            c["lat"],
            c["lng"]
        )

        results.append({
            "name": c["name"],
            "lat": c["lat"],
            "lng": c["lng"],
            "distance": dist
        })

    results.sort(key=lambda x: x["distance"])

    return results[:top_k]