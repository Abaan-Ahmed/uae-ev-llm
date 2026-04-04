#!/usr/bin/env python3
"""
UAE EV Charging LLM Evaluation Harness
=======================================
Runs structured test queries against configured models, scoring each on
4 dimensions:

  Accuracy   – did backend return the expected charger / city / type?
  Reasoning  – does the LLM response mention relevant detail?
  Tool Usage – does the LLM cite real charger names vs hallucinate?
  Latency    – end-to-end response time in seconds

Usage:
  python eval.py                           # all models, all queries
  python eval.py --models llama3 mistral   # specific models
  python eval.py --query-ids Q01 Q05 Q10  # specific queries
  python eval.py --out results.json        # custom output path
  python eval.py --timeout 300            # custom per-query timeout (seconds)
"""

import argparse
import csv
import json
import re
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import requests

# ── Config ────────────────────────────────────────────────────────────────────

BACKEND_URL     = "http://localhost:8000"
DEFAULT_MODELS  = ["llama3", "mistral", "gemma", "phi"]
QUERIES_FILE    = Path(__file__).parent / "eval_queries.json"
CHARGERS_FILE   = Path(__file__).parent / "uae_ev_chargers.json"
DEFAULT_OUT     = Path(__file__).parent / "eval_results.json"
DEFAULT_TIMEOUT = 120


# ── Dataset helpers ───────────────────────────────────────────────────────────

def load_charger_names() -> set[str]:
    """All charger names in the dataset (lower-cased for fuzzy matching)."""
    with open(CHARGERS_FILE) as f:
        data = json.load(f)
    return {c["name"].lower() for c in data}


CHARGER_NAMES: set[str] = load_charger_names()


# ── Scoring functions ─────────────────────────────────────────────────────────

def score_accuracy(returned_chargers: list[dict], expected: dict) -> float:
    """
    0.0–1.0: how well the returned chargers match the expected criteria.

    Fix: fast_only=False now checks that no fast chargers leaked through,
    rather than unconditionally awarding full marks.
    """
    if not returned_chargers:
        return 0.0

    score  = 0.0
    checks = 0

    if "city" in expected:
        checks += 1
        if any(c.get("city") == expected["city"] for c in returned_chargers):
            score += 1.0

    if "fast_only" in expected:
        checks += 1
        if expected["fast_only"]:
            # At least one fast charger present
            if any(c.get("is_fast_charger") for c in returned_chargers):
                score += 1.0
        else:
            # No fast chargers should be present (filter correctly not applied)
            if not any(c.get("is_fast_charger") for c in returned_chargers):
                score += 1.0

    if "operator" in expected:
        checks += 1
        exp_op = expected["operator"].lower()
        if any(c.get("operator", "").lower() == exp_op for c in returned_chargers):
            score += 1.0

    if "nearest_charger" in expected:
        checks += 1
        exp_name = expected["nearest_charger"].lower()
        # Normalize unicode apostrophes before comparing
        exp_norm = exp_name.replace("\u2019", "'").replace("\u2018", "'")
        for c in returned_chargers:
            c_norm = c.get("name", "").lower().replace("\u2019", "'").replace("\u2018", "'")
            if exp_norm in c_norm or c_norm in exp_norm:
                score += 1.0
                break

    if "min_power_kw" in expected:
        checks += 1
        if any((c.get("power_kw") or 0) >= expected["min_power_kw"]
               for c in returned_chargers):
            score += 1.0

    if "connector" in expected:
        checks += 1
        exp_conn = expected["connector"].lower()
        for c in returned_chargers:
            if any(exp_conn in conn.lower() for conn in c.get("connectors", [])):
                score += 1.0
                break

    return round(score / checks, 3) if checks else 0.5


def score_reasoning(llm_response: str, expected: dict) -> float:
    """
    0.0–1.0: does the LLM response demonstrate data-aware reasoning?
    """
    text   = llm_response.lower()
    score  = 0.0
    checks = 4

    # 1. Mentions distance
    if re.search(r"\d+\.?\d*\s*km", text):
        score += 1.0

    # 2. Mentions charger type or power
    if any(kw in text for kw in [" ac ", " dc ", "kw", "kilowatt", "fast charge", "fast charger"]):
        score += 1.0

    # 3. Mentions connector info
    if any(kw in text for kw in ["ccs", "chademo", "type 2", "connector", "plug"]):
        score += 1.0

    # 4. Makes a recommendation or names a charger
    if any(kw in text for kw in ["recommend", "nearest", "closest", "best option",
                                   "suggest", "head to", "go to", "located"]):
        score += 1.0

    # Per-query reasoning keywords
    for kw in expected.get("reasoning_keywords", []):
        checks += 1
        if kw.lower() in text:
            score += 1.0

    return round(score / checks, 3) if checks else 0.0


def score_tool_usage(llm_response: str, returned_chargers: list[dict]) -> float:
    """
    1.0 – model named real charger(s) from backend
    0.5 – generic response, no charger names cited
    0.0 – model mentioned a charger name NOT in the result set (hallucination)
    """
    text = llm_response.lower()
    real_names = {c["name"].lower() for c in returned_chargers}

    cited_real  = any(name in text for name in real_names)
    hallucinated = any(
        name in text
        for name in CHARGER_NAMES - real_names
        if len(name) > 8
    )

    if cited_real and not hallucinated:
        return 1.0
    if hallucinated:
        return 0.0
    return 0.5


def detect_hallucinations(llm_response: str, returned_chargers: list[dict]) -> list[str]:
    text = llm_response.lower()
    real_names = {c["name"].lower() for c in returned_chargers}
    return [
        name for name in CHARGER_NAMES - real_names
        if len(name) > 8 and name in text
    ]


# ── Per-query runner ──────────────────────────────────────────────────────────

def run_query(query: dict, model: str, timeout: int) -> dict:
    payload = {
        "prompt":  query["query"],
        "model":   model,
        "lat":     query["lat"],
        "lng":     query["lng"],
        "history": [],
    }

    start = time.time()
    error = None
    result: dict = {}

    try:
        resp = requests.post(f"{BACKEND_URL}/ask", json=payload, timeout=timeout)
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
            "query_id":          query["id"],
            "model":             model,
            "location":          query["location"],
            "query":             query["query"],
            "tags":              query.get("tags", []),
            "latency_s":         latency,
            "error":             error,
            "accuracy":          0.0,
            "reasoning":         0.0,
            "tool_usage":        0.0,
            "hallucinations":    [],
            "returned_chargers": [],
            "llm_response":      "",
        }

    returned_chargers = result.get("chargers", [])
    llm_response      = result.get("answer", "")
    expected          = query.get("expected", {})

    return {
        "query_id":          query["id"],
        "model":             model,
        "location":          query["location"],
        "query":             query["query"],
        "tags":              query.get("tags", []),
        "latency_s":         latency,
        "error":             None,
        "accuracy":          score_accuracy(returned_chargers, expected),
        "reasoning":         score_reasoning(llm_response, expected),
        "tool_usage":        score_tool_usage(llm_response, returned_chargers),
        "hallucinations":    detect_hallucinations(llm_response, returned_chargers),
        "returned_chargers": [c["name"] for c in returned_chargers],
        "llm_response":      llm_response,
    }


# ── Aggregation ───────────────────────────────────────────────────────────────

def _avg(lst: list[float]) -> float:
    """Safe average — returns 0.0 for empty lists."""
    return round(sum(lst) / len(lst), 3) if lst else 0.0


def aggregate(results: list[dict]) -> dict:
    """Compute per-model summary stats including per-tag breakdowns."""
    # Fix: avg defined once at module level (not inside a loop)
    per_model: dict = defaultdict(lambda: {
        "accuracy": [], "reasoning": [], "tool_usage": [],
        "latency": [], "errors": 0, "hallucinations": 0,
        "by_tag": defaultdict(lambda: {"accuracy": [], "reasoning": [], "tool_usage": []}),
    })

    for r in results:
        m = r["model"]
        if r["error"]:
            per_model[m]["errors"] += 1
            continue
        per_model[m]["accuracy"].append(r["accuracy"])
        per_model[m]["reasoning"].append(r["reasoning"])
        per_model[m]["tool_usage"].append(r["tool_usage"])
        per_model[m]["latency"].append(r["latency_s"])
        if r["hallucinations"]:
            per_model[m]["hallucinations"] += 1
        for tag in r.get("tags", []):
            per_model[m]["by_tag"][tag]["accuracy"].append(r["accuracy"])
            per_model[m]["by_tag"][tag]["reasoning"].append(r["reasoning"])
            per_model[m]["by_tag"][tag]["tool_usage"].append(r["tool_usage"])

    summary = {}
    for model, s in per_model.items():
        tag_breakdown = {
            tag: {
                "avg_accuracy":   _avg(v["accuracy"]),
                "avg_reasoning":  _avg(v["reasoning"]),
                "avg_tool_usage": _avg(v["tool_usage"]),
                "count":          len(v["accuracy"]),
            }
            for tag, v in s["by_tag"].items()
        }
        summary[model] = {
            "avg_accuracy":   _avg(s["accuracy"]),
            "avg_reasoning":  _avg(s["reasoning"]),
            "avg_tool_usage": _avg(s["tool_usage"]),
            "avg_latency_s":  _avg(s["latency"]),
            "total_queries":  len(s["accuracy"]) + s["errors"],
            "errors":         s["errors"],
            "hallucinations": s["hallucinations"],
            "by_tag":         tag_breakdown,
        }
    return summary


def print_summary(summary: dict) -> None:
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
    print("=" * 74)

    # Per-tag breakdown
    all_tags: set[str] = set()
    for s in summary.values():
        all_tags.update(s.get("by_tag", {}).keys())

    if all_tags:
        print("\nPer-tag accuracy breakdown:")
        for tag in sorted(all_tags):
            row = f"  [{tag}]"
            for model in sorted(summary):
                bt = summary[model].get("by_tag", {}).get(tag)
                if bt:
                    row += f"  {model}={bt['avg_accuracy']:.2f}({bt['count']})"
            print(row)
    print()


# ── CSV export ────────────────────────────────────────────────────────────────

def write_csv(results: list[dict], path: Path) -> None:
    csv_path = path.with_suffix(".csv")
    fields = [
        "query_id", "model", "location", "query", "tags",
        "accuracy", "reasoning", "tool_usage", "latency_s", "error", "hallucinations",
    ]
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in results:
            row = {k: r.get(k, "") for k in fields}
            row["tags"]           = "; ".join(r.get("tags", []))
            row["hallucinations"] = "; ".join(r.get("hallucinations", []))
            w.writerow(row)
    print(f"CSV  → {csv_path}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="UAE EV LLM Evaluation Harness")
    parser.add_argument("--models",     nargs="+", default=DEFAULT_MODELS)
    parser.add_argument("--query-ids",  nargs="+", default=None,
                        help="Run only specific query IDs (e.g. Q01 Q05)")
    parser.add_argument("--out",        default=str(DEFAULT_OUT))
    parser.add_argument("--timeout",    type=int, default=DEFAULT_TIMEOUT,
                        help="Per-query request timeout in seconds (default: 120)")
    args = parser.parse_args()

    with open(QUERIES_FILE) as f:
        all_queries = json.load(f)

    queries = (
        [q for q in all_queries if q["id"] in args.query_ids]
        if args.query_ids else all_queries
    )

    models = args.models
    total  = len(queries) * len(models)

    print(f"\nUAE EV Charging LLM Evaluation")
    print(f"Models:   {', '.join(models)}")
    print(f"Queries:  {len(queries)}")
    print(f"Total:    {total} runs")
    print(f"Timeout:  {args.timeout}s per query")
    print(f"Backend:  {BACKEND_URL}\n")

    try:
        requests.get(f"{BACKEND_URL}/health", timeout=5)
    except Exception:
        print("ERROR: Cannot reach backend. Run `uvicorn main:app --reload` first.")
        return

    results: list[dict] = []
    done = 0

    for model in models:
        print(f"\n── Model: {model} ──")
        for q in queries:
            done += 1
            print(f"  [{done:>2}/{total}] {q['id']} – {q['query'][:55]}…", end="", flush=True)
            r = run_query(q, model, args.timeout)
            results.append(r)
            if r["error"]:
                print(f"  ERROR: {r['error']}")
            else:
                halluc_flag = "  ⚠ HALLUC" if r["hallucinations"] else ""
                print(
                    f"  acc={r['accuracy']:.2f} reason={r['reasoning']:.2f} "
                    f"tool={r['tool_usage']:.2f} {r['latency_s']:.1f}s{halluc_flag}"
                )

    summary = aggregate(results)
    print_summary(summary)

    output = {
        "run_at":  datetime.now().isoformat(),
        "models":  models,
        "summary": summary,
        "results": results,
    }

    out_path = Path(args.out)
    out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False))
    print(f"JSON → {out_path}")
    write_csv(results, out_path)


if __name__ == "__main__":
    main()
