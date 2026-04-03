#!/usr/bin/env python3
"""
UAE EV Charging LLM Evaluation Harness
=======================================
Runs 20 structured test queries against all configured models,
scoring each on 4 dimensions:

  Accuracy   – did backend return the expected charger / city / type?
  Reasoning  – does the LLM response mention relevant detail (distance, type, kW)?
  Tool Usage – does the LLM cite real charger names vs hallucinate?
  Latency    – end-to-end response time in seconds

Usage:
  python eval.py                          # all models, all queries
  python eval.py --models llama3 mistral  # specific models
  python eval.py --query-ids Q01 Q05 Q10 # specific queries
  python eval.py --out results.json       # custom output path
"""

import argparse
import csv
import json
import time
import re
from datetime import datetime
from pathlib import Path

import requests

# ── Config ────────────────────────────────────────────────────────────────────

BACKEND_URL   = "http://localhost:8000"
DEFAULT_MODELS = ["llama3", "mistral", "gemma", "phi"]
QUERIES_FILE  = Path(__file__).parent / "eval_queries.json"
CHARGERS_FILE = Path(__file__).parent / "uae_ev_chargers.json"
DEFAULT_OUT   = Path(__file__).parent / "eval_results.json"


# ── Dataset helpers ───────────────────────────────────────────────────────────

def load_charger_names() -> set[str]:
    """All charger names in the dataset (lower-cased for fuzzy matching)."""
    with open(CHARGERS_FILE) as f:
        data = json.load(f)
    return {c["name"].lower() for c in data}


CHARGER_NAMES = load_charger_names()

REASONING_KEYWORDS = [
    "km", "kilometer", "distance", "fast", "slow", "ac", "dc",
    "kw", "connector", "type 2", "ccs", "chademo", "tesla",
    "nearest", "closest", "recommend",
]


# ── Scoring ───────────────────────────────────────────────────────────────────

def score_accuracy(returned_chargers: list[dict], expected: dict) -> float:
    """
    0.0 – 1.0: how well the returned chargers match the expectations.
    """
    if not returned_chargers:
        return 0.0

    score = 0.0
    checks = 0

    # Check city
    if "city" in expected:
        checks += 1
        if any(c.get("city") == expected["city"] for c in returned_chargers):
            score += 1.0

    # Check fast_only
    if "fast_only" in expected:
        checks += 1
        if expected["fast_only"]:
            if any(c.get("is_fast_charger") for c in returned_chargers):
                score += 1.0
        else:
            score += 1.0  # any charger is fine

    # Check operator
    if "operator" in expected:
        checks += 1
        exp_op = expected["operator"].lower()
        if any(c.get("operator", "").lower() == exp_op for c in returned_chargers):
            score += 1.0

    # Check nearest_charger (partial name match)
    if "nearest_charger" in expected:
        checks += 1
        exp_name = expected["nearest_charger"].lower()
        if any(exp_name in c.get("name", "").lower() for c in returned_chargers):
            score += 1.0

    # Check min_power_kw
    if "min_power_kw" in expected:
        checks += 1
        if any((c.get("power_kw") or 0) >= expected["min_power_kw"]
               for c in returned_chargers):
            score += 1.0

    return round(score / checks, 3) if checks else 0.5


def score_reasoning(llm_response: str, expected: dict) -> float:
    """
    0.0 – 1.0: does the LLM response demonstrate understanding of the data?
    """
    text = llm_response.lower()
    score = 0.0
    checks = 4

    # 1. Mentions distance / km
    if re.search(r"\d+\.?\d*\s*km", text):
        score += 1.0

    # 2. Mentions charger type (AC / DC / kW)
    if any(kw in text for kw in ["ac ", "dc ", "kw", "kilowatt", "fast charge"]):
        score += 1.0

    # 3. Mentions connector info
    if any(kw in text for kw in ["ccs", "chademo", "type 2", "connector", "plug"]):
        score += 1.0

    # 4. Makes a recommendation or names a charger
    if any(kw in text for kw in ["recommend", "nearest", "closest", "best option",
                                   "suggest", "head to", "go to"]):
        score += 1.0

    # Bonus: if expected has reasoning_keywords, check them
    bonus_checks = expected.get("reasoning_keywords", [])
    if bonus_checks:
        checks += len(bonus_checks)
        for kw in bonus_checks:
            if kw.lower() in text:
                score += 1.0

    return round(score / checks, 3) if checks else 0.0


def score_tool_usage(llm_response: str, returned_chargers: list[dict]) -> float:
    """
    1.0 – model cited real charger names from backend data
    0.5 – generic response, no charger names mentioned
    0.0 – model mentioned names NOT in the dataset (hallucination)
    """
    text = llm_response.lower()

    # Names actually returned by backend for this query
    real_names = {c["name"].lower() for c in returned_chargers}

    # Check if any real name is in the response
    cited_real = any(name in text for name in real_names)

    # Check if any hallucinated name appears
    # (any charger name NOT in returned_chargers but mentioned in response)
    hallucinated = False
    for charger_name in CHARGER_NAMES - real_names:
        if len(charger_name) > 8 and charger_name in text:
            hallucinated = True
            break

    if cited_real and not hallucinated:
        return 1.0
    elif hallucinated:
        return 0.0
    else:
        return 0.5  # generic response, no names at all


def detect_hallucinations(llm_response: str, returned_chargers: list[dict]) -> list[str]:
    """Return a list of hallucinated charger name fragments found in the response."""
    text = llm_response.lower()
    real_names = {c["name"].lower() for c in returned_chargers}
    found = []
    for name in CHARGER_NAMES - real_names:
        if len(name) > 8 and name in text:
            found.append(name)
    return found


# ── Single query runner ───────────────────────────────────────────────────────

def run_query(query: dict, model: str) -> dict:
    """
    Hit the backend /ask endpoint and return a scored result dict.
    """
    payload = {
        "prompt": query["query"],
        "model":  model,
        "lat":    query["lat"],
        "lng":    query["lng"],
        "history": [],
    }

    start = time.time()
    error = None
    result = {}

    try:
        resp = requests.post(f"{BACKEND_URL}/ask", json=payload, timeout=120)
        resp.raise_for_status()
        result = resp.json()
    except requests.exceptions.Timeout:
        error = "TIMEOUT"
    except requests.exceptions.ConnectionError:
        error = "CONNECTION_REFUSED"
    except Exception as e:
        error = str(e)

    latency = round(time.time() - start, 2)

    if error:
        return {
            "query_id":    query["id"],
            "model":       model,
            "location":    query["location"],
            "query":       query["query"],
            "latency_s":   latency,
            "error":       error,
            "accuracy":    0.0,
            "reasoning":   0.0,
            "tool_usage":  0.0,
            "hallucinations": [],
            "returned_chargers": [],
            "llm_response": "",
        }

    returned_chargers = result.get("chargers", [])
    llm_response      = result.get("answer", "")
    expected          = query.get("expected", {})

    accuracy   = score_accuracy(returned_chargers, expected)
    reasoning  = score_reasoning(llm_response, expected)
    tool_usage = score_tool_usage(llm_response, returned_chargers)
    hallucinations = detect_hallucinations(llm_response, returned_chargers)

    return {
        "query_id":          query["id"],
        "model":             model,
        "location":          query["location"],
        "query":             query["query"],
        "tags":              query.get("tags", []),
        "latency_s":         latency,
        "error":             None,
        "accuracy":          accuracy,
        "reasoning":         reasoning,
        "tool_usage":        tool_usage,
        "hallucinations":    hallucinations,
        "returned_chargers": [c["name"] for c in returned_chargers],
        "llm_response":      llm_response,
    }


# ── Aggregate stats ───────────────────────────────────────────────────────────

def aggregate(results: list[dict]) -> dict[str, dict]:
    """Compute per-model summary stats."""
    from collections import defaultdict

    stats: dict = defaultdict(lambda: {
        "accuracy": [], "reasoning": [], "tool_usage": [],
        "latency": [], "errors": 0, "hallucinations": 0
    })

    for r in results:
        m = r["model"]
        if r["error"]:
            stats[m]["errors"] += 1
            continue
        stats[m]["accuracy"].append(r["accuracy"])
        stats[m]["reasoning"].append(r["reasoning"])
        stats[m]["tool_usage"].append(r["tool_usage"])
        stats[m]["latency"].append(r["latency_s"])
        if r["hallucinations"]:
            stats[m]["hallucinations"] += 1

    summary = {}
    for model, s in stats.items():
        def avg(lst): return round(sum(lst)/len(lst), 3) if lst else 0.0
        summary[model] = {
            "avg_accuracy":   avg(s["accuracy"]),
            "avg_reasoning":  avg(s["reasoning"]),
            "avg_tool_usage": avg(s["tool_usage"]),
            "avg_latency_s":  avg(s["latency"]),
            "total_queries":  len(s["accuracy"]) + s["errors"],
            "errors":         s["errors"],
            "hallucinations": s["hallucinations"],
        }
    return summary


def print_summary(summary: dict):
    print("\n" + "=" * 74)
    print(f"{'Model':<12} {'Accuracy':>9} {'Reasoning':>10} {'ToolUsage':>10} {'Latency':>8} {'Errors':>7} {'Halluc':>7}")
    print("-" * 74)
    for model, s in sorted(summary.items()):
        print(
            f"{model:<12}"
            f"{s['avg_accuracy']:>9.3f}"
            f"{s['avg_reasoning']:>10.3f}"
            f"{s['avg_tool_usage']:>10.3f}"
            f"{s['avg_latency_s']:>7.1f}s"
            f"{s['errors']:>7}"
            f"{s['hallucinations']:>7}"
        )
    print("=" * 74 + "\n")


# ── CSV export ────────────────────────────────────────────────────────────────

def write_csv(results: list[dict], path: Path):
    csv_path = path.with_suffix(".csv")
    fields = ["query_id", "model", "location", "query", "accuracy",
              "reasoning", "tool_usage", "latency_s", "error", "hallucinations"]
    with open(csv_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in results:
            row = {k: r.get(k, "") for k in fields}
            row["hallucinations"] = "; ".join(r.get("hallucinations", []))
            w.writerow(row)
    print(f"CSV written → {csv_path}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="UAE EV LLM Evaluation Harness")
    parser.add_argument("--models",    nargs="+", default=DEFAULT_MODELS)
    parser.add_argument("--query-ids", nargs="+", default=None,
                        help="Run only specific query IDs (e.g. Q01 Q05)")
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    args = parser.parse_args()

    with open(QUERIES_FILE) as f:
        all_queries = json.load(f)

    if args.query_ids:
        queries = [q for q in all_queries if q["id"] in args.query_ids]
    else:
        queries = all_queries

    models = args.models
    total  = len(queries) * len(models)

    print(f"\nUAE EV Charging LLM Evaluation")
    print(f"Models:  {', '.join(models)}")
    print(f"Queries: {len(queries)}")
    print(f"Total runs: {total}")
    print(f"Backend: {BACKEND_URL}\n")

    # Check backend is up
    try:
        requests.get(f"{BACKEND_URL}/health", timeout=5)
    except Exception:
        print("ERROR: Cannot reach backend. Run `uvicorn main:app --reload` first.")
        return

    results = []
    done = 0

    for model in models:
        print(f"\n── Model: {model} ──")
        for q in queries:
            done += 1
            print(f"  [{done:>2}/{total}] {q['id']} – {q['query'][:55]}…", end="", flush=True)
            r = run_query(q, model)
            results.append(r)
            if r["error"]:
                print(f"  ERROR: {r['error']}")
            else:
                print(f"  acc={r['accuracy']:.2f} reason={r['reasoning']:.2f} "
                      f"tool={r['tool_usage']:.2f} {r['latency_s']:.1f}s"
                      + (f"  ⚠ HALLUC" if r["hallucinations"] else ""))

    summary = aggregate(results)
    print_summary(summary)

    output = {
        "run_at":  datetime.now().isoformat(),
        "models":  models,
        "summary": summary,
        "results": results,
    }

    out_path = Path(args.out)
    out_path.write_text(json.dumps(output, indent=2))
    print(f"JSON written → {out_path}")
    write_csv(results, out_path)


if __name__ == "__main__":
    main()
