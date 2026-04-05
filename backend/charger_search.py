import json
import re
from pathlib import Path
from distance import calculate_distance

# Load charger dataset relative to this file (works regardless of CWD)
_DATA_PATH = Path(__file__).parent / "uae_ev_chargers.json"
with open(_DATA_PATH) as f:
    chargers = json.load(f)


# ---------------------------------------------------------------------------
# Keyword lists
# ---------------------------------------------------------------------------

# Use word-boundary regex patterns to avoid substring false-positives

FAST_CHARGER_PATTERNS = [
    r"\bfast\b", r"\bquick\b", r"\brapid\b", r"\bdc\b",
    r"\bsupercharger\b", r"\bfast-charger\b", r"\bfast charger\b",
    r"\bquick charge\b", r"\blevel 3\b", r"\blvl 3\b", r"\blevel3\b",
]
SLOW_CHARGER_PATTERNS = [
    r"\bslow\b", r"\bac\b", r"\bstandard\b", r"\bovernight\b",
    r"\blevel 2\b", r"\blvl 2\b", r"\blevel2\b",
]
TESLA_PATTERNS     = [r"\btesla\b", r"\bsupercharger\b"]
ADNOC_PATTERNS     = [r"\badnoc\b"]
DEWA_PATTERNS      = [r"\bdewa\b"]
NON_TESLA_PATTERNS = [
    r"\bnon-tesla\b", r"\bnon tesla\b", r"\bnot tesla\b",
    r"\bother than tesla\b", r"\bno tesla\b",
]

# City name synonyms (maps alias regex → canonical city list in dataset)
CITY_ALIASES: list[tuple[str, list[str]]] = [
    (r"\bdubaicity\b|\bdubai\b",                      ["Dubai"]),
    (r"\babu\s+dhabi\b|\babudhabi\b",                 ["Abu Dhabi"]),
    (r"\bsharjah\b",                                   ["Sharjah"]),
    (r"\bajman\b",                                     ["Ajman"]),
    (r"\brak\b|\bras\s+al\s+khaimah\b",               ["Ras Al Khaimah"]),
    (r"\bfujairah\b",                                  ["Fujairah"]),
    (r"\bumm\s+al\s+quwain\b|\buaq\b",                ["Umm Al Quwain"]),
    (r"\bal\s+ain\b|\balain\b",                        ["Al Ain"]),
]

CONNECTOR_MAP: list[tuple[str, str]] = [
    (r"\bccs2\b",  "CCS2"),
    (r"\bccs\b",   "CCS2"),
    (r"\bchademo\b", "CHAdeMO"),
    (r"\btype\s*2\b", "Type 2"),
    (r"\bj1772\b", "Type 1 (J1772)"),
]


def _match_any(text: str, patterns: list[str]) -> bool:
    """Return True if any pattern matches in text (case-insensitive)."""
    return any(re.search(p, text, re.IGNORECASE) for p in patterns)


def parse_query_filters(prompt: str) -> dict:
    """
    Extract structured filters from a natural-language prompt.

    Returns a dict with optional keys:
      fast_only        : bool
      slow_only        : bool
      exclude_operator : str    (e.g. "Tesla")
      operator         : str    (e.g. "Tesla", "ADNOC", "DEWA")
      min_power_kw     : float
      city             : list[str]
      connector        : str    (e.g. "CCS2", "CHAdeMO", "Type 2")
    """
    filters: dict = {}
    p = prompt  # keep original case for context

    # Non-Tesla exclusion must be checked BEFORE Tesla detection
    if _match_any(p, NON_TESLA_PATTERNS):
        filters["exclude_operator"] = "Tesla"
    elif _match_any(p, TESLA_PATTERNS):
        filters["operator"] = "Tesla"

    # Charger speed (AC/DC)
    if _match_any(p, FAST_CHARGER_PATTERNS):
        filters["fast_only"] = True
    elif _match_any(p, SLOW_CHARGER_PATTERNS):
        filters["slow_only"] = True

    # Other operators
    if "operator" not in filters:
        if _match_any(p, ADNOC_PATTERNS):
            filters["operator"] = "ADNOC"
        elif _match_any(p, DEWA_PATTERNS):
            filters["operator"] = "DEWA"

    # Minimum power from explicit kW mention  e.g. "at least 50kw"
    kw_match = re.search(r"\b(\d+)\s*kw\b", p, re.IGNORECASE)
    if kw_match:
        filters["min_power_kw"] = float(kw_match.group(1))

    # City / area (first match wins)
    for pattern, cities in CITY_ALIASES:
        if re.search(pattern, p, re.IGNORECASE):
            filters["city"] = cities
            break

    # Connector type (most specific first)
    for pattern, connector in CONNECTOR_MAP:
        if re.search(pattern, p, re.IGNORECASE):
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

    exclude_op = filters.get("exclude_operator")
    if exclude_op and c.get("operator", "").lower() == exclude_op.lower():
        return False

    min_kw = filters.get("min_power_kw")
    if min_kw is not None and (c.get("power_kw") or 0) < min_kw:
        return False

    city_filter = filters.get("city")
    if city_filter and c.get("city") not in city_filter:
        return False

    connector = filters.get("connector")
    if connector:
        # Match against connector list; exclude Tesla-branded variants for non-Tesla queries
        conn_list = c.get("connectors", [])
        is_tesla_charger = c.get("operator", "").lower() == "tesla"
        has_connector = any(connector.lower() in conn.lower() for conn in conn_list)
        # If user explicitly excluded Tesla, skip Tesla-proprietary connectors
        if filters.get("exclude_operator", "").lower() == "tesla" and is_tesla_charger:
            return False
        if not has_connector:
            return False

    return True


def find_nearest_chargers(
    user_lat: float,
    user_lng: float,
    prompt: str = "",
    top_k: int = 5,
) -> dict:
    """
    Find the top_k nearest chargers that match semantic filters inferred
    from *prompt*.

    Returns:
        {
          "chargers": [...],         # list of matched charger dicts with distance
          "filters_applied": {...}   # the parsed filters (for LLM context)
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

    # Graceful fallback: if semantic filters yield zero results, fall back to
    # distance-only so the user always gets something useful
    if not matched and filters:
        fallback = []
        for c in chargers:
            dist = calculate_distance(user_lat, user_lng, c["lat"], c["lng"])
            fallback.append({**c, "distance": round(dist, 2)})
        fallback.sort(key=lambda x: x["distance"])
        matched = fallback[:top_k]
        filters["_fallback"] = True   # flag so LLM can explain the fallback

    return {"chargers": matched, "filters_applied": filters}
