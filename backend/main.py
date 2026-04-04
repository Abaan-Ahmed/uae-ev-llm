import asyncio
import json
import re
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import ollama

from charger_search import find_nearest_chargers

app = FastAPI(title="UAE EV Charging API")

# Fix #3: allow_credentials must be False when allow_origins=["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Fix #4: resolve data path relative to this file, not CWD
_CHARGERS_PATH = Path(__file__).parent / "uae_ev_chargers.json"
_EVAL_RESULTS_PATH = Path(__file__).parent / "eval_results.json"

# Fix #8: cache charger list once at startup rather than re-reading on each request
with open(_CHARGERS_PATH) as f:
    _ALL_CHARGERS: list[dict] = json.load(f)

# Fix #11: max conversation history turns sent to LLM (prevents context overflow)
MAX_HISTORY_TURNS = 12


# ── Models ────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str


class PromptRequest(BaseModel):
    prompt: str
    model: str
    # Fix: validate lat/lng ranges
    lat: float = Field(default=24.4539, ge=-90.0, le=90.0)
    lng: float = Field(default=54.3773, ge=-180.0, le=180.0)
    history: list[ChatMessage] = []


# ── Helpers ───────────────────────────────────────────────────────────────────

def _charger_context(charger: dict) -> str:
    """Format a single charger into a readable line for the LLM system prompt."""
    parts = [f"- {charger['name']} ({charger['distance']} km away)"]
    details = []
    if charger.get("charger_type"):
        details.append(charger["charger_type"])
    if charger.get("power_kw"):
        details.append(f"{charger['power_kw']} kW")
    if charger.get("connectors"):
        details.append("connectors: " + ", ".join(charger["connectors"]))
    if charger.get("operator") and charger["operator"] != "Unknown":
        details.append(f"operator: {charger['operator']}")
    if charger.get("num_connectors"):
        details.append(f"{charger['num_connectors']} points")
    if charger.get("city"):
        details.append(charger["city"])
    if details:
        parts.append("  [" + ", ".join(details) + "]")
    return "\n".join(parts)


def build_system_prompt(chargers: list, filters: dict) -> str:
    charger_context = "\n".join(_charger_context(c) for c in chargers)

    fallback_note = ""
    if filters.get("_fallback"):
        fallback_note = (
            "\nNote: No chargers matched the user's specific criteria, "
            "so the nearest chargers are shown instead. Mention this politely."
        )

    filter_summary = ""
    if filters:
        clean = {k: v for k, v in filters.items() if not k.startswith("_")}
        if clean:
            filter_summary = f"\nSearch filters applied: {json.dumps(clean)}"

    return f"""You are an EV charging assistant for the UAE. You have been given verified charger data from the backend — use it directly in your answer.

Nearby chargers matching the user's request:
{charger_context}
{filter_summary}{fallback_note}

Guidelines:
- Reference the chargers above by name. Do NOT invent or mention any charger not listed above.
- Mention charger type (AC/DC), power (kW), and connector types when relevant.
- Include distance so the user knows how far each option is.
- Be concise and friendly. If the user asked for something specific (e.g. fast charger, Tesla), confirm whether results match.
- You have access to conversation history — reference prior context when relevant.
"""


def build_messages(
    system_prompt: str,
    history: list[ChatMessage],
    prompt: str,
) -> list[dict]:
    msgs = [{"role": "system", "content": system_prompt}]
    # Fix #11: cap history to prevent context window overflow
    trimmed = history[-(MAX_HISTORY_TURNS * 2):]
    for msg in trimmed:
        msgs.append({"role": msg.role, "content": msg.content})
    msgs.append({"role": "user", "content": prompt})
    return msgs


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/ask")
async def ask_question(data: PromptRequest):
    """Non-streaming endpoint (kept for eval harness compatibility)."""
    result = find_nearest_chargers(data.lat, data.lng, prompt=data.prompt)
    chargers = result["chargers"]
    filters = result["filters_applied"]

    system_prompt = build_system_prompt(chargers, filters)
    messages = build_messages(system_prompt, data.history, data.prompt)

    # Fix #5: run blocking ollama call in a thread so the event loop stays free
    response = await asyncio.to_thread(
        ollama.chat, model=data.model, messages=messages
    )

    return {
        "answer": response["message"]["content"],
        "chargers": chargers,
    }


@app.post("/ask/stream")
async def ask_stream(data: PromptRequest):
    """Streaming endpoint — sends SSE events: chargers → tokens → done."""
    result = find_nearest_chargers(data.lat, data.lng, prompt=data.prompt)
    chargers = result["chargers"]
    filters = result["filters_applied"]

    system_prompt = build_system_prompt(chargers, filters)
    messages = build_messages(system_prompt, data.history, data.prompt)

    async def generate():
        # Send charger data immediately so the map updates before text arrives
        yield f"data: {json.dumps({'type': 'chargers', 'chargers': chargers})}\n\n"

        try:
            # Run blocking stream iterator in a thread
            def _stream():
                return list(ollama.chat(model=data.model, messages=messages, stream=True))

            chunks = await asyncio.to_thread(_stream)
            for chunk in chunks:
                token = chunk["message"]["content"]
                if token:
                    yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── Structured output (anti-hallucination) endpoint ───────────────────────────

PARSE_SYSTEM = """You are a query parser for a UAE EV charging assistant.
Parse the user's query into a JSON object only — no other text, no markdown fences.

Return exactly this shape:
{
  "fast_only": true | false | null,
  "operator": "Tesla" | "ADNOC" | "DEWA" | null,
  "exclude_operator": "Tesla" | null,
  "city": "Dubai" | "Abu Dhabi" | "Sharjah" | "Ajman" | "Ras Al Khaimah" | "Fujairah" | "Al Ain" | null,
  "min_power_kw": <number> | null,
  "connector": "CCS2" | "CHAdeMO" | "Type 2" | null,
  "intent_summary": "<one sentence describing what the user wants>"
}

Rules:
- "fast", "quick", "rapid", "DC", "supercharger" → fast_only: true
- "slow", "AC", "overnight", "level 2" → fast_only: false
- "non-tesla", "not tesla", "non-Tesla EV" → exclude_operator: "Tesla", operator: null
- Named city → set city field
- Explicit kW value → set min_power_kw
- All unknown fields must be null (never omit them)
"""


@app.post("/ask/structured")
async def ask_structured(data: PromptRequest):
    """
    Two-phase anti-hallucination endpoint:
      Phase 1 – LLM parses user intent into structured JSON (no charger knowledge)
      Phase 2 – Backend runs query using parsed filters (pure code, guaranteed real data)
      Phase 3 – LLM narrates only the verified backend results
    """
    # ── Phase 1: Intent parsing ──────────────────────────────────────────────
    parse_response = await asyncio.to_thread(
        ollama.chat,
        model=data.model,
        messages=[
            {"role": "system", "content": PARSE_SYSTEM},
            {"role": "user",   "content": data.prompt},
        ],
    )

    raw_json = parse_response["message"]["content"].strip()
    raw_json = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_json, flags=re.MULTILINE).strip()

    parsed_action: dict = {}
    parse_error: str | None = None
    try:
        parsed_action = json.loads(raw_json)
    except json.JSONDecodeError as e:
        parse_error = str(e)

    # ── Phase 2: Backend execution ───────────────────────────────────────────
    # Build synthetic query string from the parsed action
    synthetic_query = data.prompt
    if parsed_action.get("fast_only"):
        synthetic_query += " fast charger"
    if parsed_action.get("exclude_operator"):
        synthetic_query += f" non-{parsed_action['exclude_operator']}"
    if parsed_action.get("operator"):
        synthetic_query += f" {parsed_action['operator']}"
    if parsed_action.get("city"):
        synthetic_query += f" in {parsed_action['city']}"
    if parsed_action.get("connector"):
        synthetic_query += f" {parsed_action['connector']}"
    if parsed_action.get("min_power_kw"):
        synthetic_query += f" {parsed_action['min_power_kw']}kw"

    result   = find_nearest_chargers(data.lat, data.lng, prompt=synthetic_query)
    chargers = result["chargers"]
    filters  = result["filters_applied"]

    # ── Phase 3: Grounded narration ──────────────────────────────────────────
    charger_context = "\n".join(_charger_context(c) for c in chargers)
    intent_summary  = parsed_action.get("intent_summary", data.prompt)

    narrate_system = f"""You are an EV charging assistant for the UAE.
The backend has verified and returned these chargers. Reference ONLY these results.
DO NOT mention any charger not listed below.

{charger_context}

User's intent: {intent_summary}

Write a helpful, concise response covering charger type, power, connectors, and distance.
"""

    messages = [{"role": "system", "content": narrate_system}]
    trimmed_history = data.history[-(MAX_HISTORY_TURNS * 2):]
    for msg in trimmed_history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": data.prompt})

    narrate_response = await asyncio.to_thread(
        ollama.chat, model=data.model, messages=messages
    )

    return {
        "answer":          narrate_response["message"]["content"],
        "chargers":        chargers,
        "parsed_action":   parsed_action,
        "parse_error":     parse_error,
        "filters_applied": filters,
    }


@app.get("/health")
async def health_check():
    """Returns Ollama status and list of installed models."""
    try:
        # Fix #19: handle both old dict-style and new object-style ollama responses
        models_response = await asyncio.to_thread(ollama.list)
        raw_models = models_response.get("models", []) if isinstance(models_response, dict) else getattr(models_response, "models", [])
        model_names = []
        for m in raw_models:
            if isinstance(m, dict):
                model_names.append(m.get("name") or m.get("model", ""))
            else:
                model_names.append(getattr(m, "model", getattr(m, "name", str(m))))
        return {"status": "ok", "models": [n for n in model_names if n]}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/chargers")
async def get_chargers():
    """Returns the full cached charger dataset for the map."""
    return _ALL_CHARGERS


@app.get("/eval-results")
async def get_eval_results():
    """Serves latest eval run results to the dashboard."""
    if not _EVAL_RESULTS_PATH.exists():
        return {"error": "No eval results found. Run: python eval.py"}
    with open(_EVAL_RESULTS_PATH) as f:
        return json.load(f)
