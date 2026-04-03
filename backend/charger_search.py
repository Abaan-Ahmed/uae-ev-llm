import json
import re
from distance import calculate_distance

# Load charger dataset
with open("uae_ev_chargers.json") as f:
    chargers = json.load(f)


# ---------------------------------------------------------------------------
# Semantic intent parser
# ---------------------------------------------------------------------------

# Keywords that map to structured filters
FAST_CHARGER_KEYWORDS = [
    "fast", "quick", "rapid", "dc", "supercharger", "fast-charger",
    "fast charger", "quick charge", "level 3", "lvl 3", "level3"
]
SLOW_CHARGER_KEYWORDS = [
    "slow", "ac", "standard", "level 2", "lvl 2", "level2", "overnight"
]
TESLA_KEYWORDS = ["tesla", "supercharger"]
ADNOC_KEYWORDS = ["adnoc"]
DEWA_KEYWORDS  = ["dewa"]
HIGH_POWER_KEYWORDS = ["high power", "high-power", "50kw", "100kw", "150kw", "250kw"]
MULTI_CONNECTOR_KEYWORDS = [
    "multiple connectors", "many connectors", "ccs", "chademo", "type 2",
    "j1772", "type2"
]

# City name synonyms (maps alias → canonical city string in dataset)
CITY_ALIASES: dict[str, list[str]] = {
    "dubai":           ["Dubai"],
    "abu dhabi":       ["Abu Dhabi"],
    "abudhabi":        ["Abu Dhabi"],
    "sharjah":         ["Sharjah"],
    "ajman":           ["Ajman"],
    "rak":             ["Ras Al Khaimah"],
    "ras al khaimah":  ["Ras Al Khaimah"],
    "fujairah":        ["Fujairah", "Umm Al Quwain / Fujairah"],
    "al ain":          ["Al Ain"],
    "alain":           ["Al Ain"],
}


def _contains_any(text: str, keywords: list[str]) -> bool:
    """Case-insensitive substring match for any keyword."""
    t = text.lower()
    return any(kw in t for kw in keywords)


def parse_query_filters(prompt: str) -> dict:
    """
    Extract structured filters from a natural-language prompt.

    Returns a dict with optional keys:
      fast_only     : bool
      slow_only     : bool
      operator      : str | None     (e.g. "Tesla", "ADNOC", "DEWA")
      min_power_kw  : float | None
      city          : list[str] | None
      connector     : str | None     (e.g. "CCS2", "CHAdeMO", "Type 2")
    """
    filters: dict = {}
    p = prompt.lower()

    # Charger speed
    if _contains_any(p, FAST_CHARGER_KEYWORDS):
        filters["fast_only"] = True
    elif _contains_any(p, SLOW_CHARGER_KEYWORDS):
        filters["slow_only"] = True

    # Operator
    if _contains_any(p, TESLA_KEYWORDS):
        filters["operator"] = "Tesla"
    elif _contains_any(p, ADNOC_KEYWORDS):
        filters["operator"] = "ADNOC"
    elif _contains_any(p, DEWA_KEYWORDS):
        filters["operator"] = "DEWA"

    # Minimum power from explicit kW mentions  e.g. "at least 50kw"
    kw_match = re.search(r"(\d+)\s*kw", p)
    if kw_match:
        filters["min_power_kw"] = float(kw_match.group(1))

    # City / area
    for alias, cities in CITY_ALIASES.items():
        if alias in p:
            filters["city"] = cities
            break

    # Connector type
    for kw, connector in [
        ("ccs2", "CCS2"), ("ccs", "CCS2"), ("chademo", "CHAdeMO"),
        ("type 2", "Type 2"), ("type2", "Type 2"),
        ("j1772", "Type 1 (J1772)"),
    ]:
        if kw in p:
            filters["connector"] = connector
            break

    return filters


# ---------------------------------------------------------------------------
# Filtered search
# ---------------------------------------------------------------------------

def _charger_matches(c: dict, filters: dict) -> bool:
    """Return True if charger satisfies all active filters."""

    if filters.get("fast_only") and not c.get("is_fast_charger"):
        return False
    if filters.get("slow_only") and c.get("is_fast_charger"):
        return False

    op = filters.get("operator")
    if op and c.get("operator", "").lower() != op.lower():
        return False

    min_kw = filters.get("min_power_kw")
    if min_kw is not None and (c.get("power_kw") or 0) < min_kw:
        return False

    city_filter = filters.get("city")
    if city_filter and c.get("city") not in city_filter:
        return False

    connector = filters.get("connector")
    if connector:
        if not any(connector.lower() in conn.lower()
                   for conn in c.get("connectors", [])):
            return False

    return True


def find_nearest_chargers(
    user_lat: float,
    user_lng: float,
    prompt: str = "",
    top_k: int = 5
) -> dict:
    """
    Find the top_k nearest chargers that match semantic filters inferred
    from *prompt*.

    Returns:
        {
          "chargers": [...],        # list of matched charger dicts with distance
          "filters_applied": {...}  # the parsed filters (for LLM context)
        }
    """
    filters = parse_query_filters(prompt)

    results = []
    for c in chargers:
        if not _charger_matches(c, filters):
            continue

        dist = calculate_distance(user_lat, user_lng, c["lat"], c["lng"])
        results.append({**c, "distance": round(dist, 2)})

    results.sort(key=lambda x: x["distance"])
    matched = results[:top_k]

    # Graceful fallback: if semantic filters yield zero results, try
    # distance-only so the user always gets something
    if not matched and filters:
        for c in chargers:
            dist = calculate_distance(user_lat, user_lng, c["lat"], c["lng"])
            results.append({**c, "distance": round(dist, 2)})
        results.sort(key=lambda x: x["distance"])
        matched = results[:top_k]
        filters["_fallback"] = True   # flag so LLM can explain

    return {"chargers": matched, "filters_applied": filters}