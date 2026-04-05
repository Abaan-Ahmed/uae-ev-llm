import asyncio
import json
import queue
import re
import threading
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import ollama

from charger_search import find_nearest_chargers

app = FastAPI(title="UAE EV Charging API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

_CHARGERS_PATH     = Path(__file__).parent / "uae_ev_chargers.json"
_EVAL_RESULTS_PATH = Path(__file__).parent / "eval_results.json"

with open(_CHARGERS_PATH) as f:
    _ALL_CHARGERS: list[dict] = json.load(f)

MAX_HISTORY_TURNS = 12


# ── Pydantic models ───────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str


class PromptRequest(BaseModel):
    prompt: str
    model: str
    lat: float = Field(default=24.4539, ge=-90.0, le=90.0)
    lng: float = Field(default=54.3773, ge=-180.0, le=180.0)
    history: list[ChatMessage] = []


# ── Ollama response helper ────────────────────────────────────────────────────

def _get_content(response) -> str:
    """
    Safely extract message content from an ollama response.
    Handles both dict-style (older library) and object-style (>=0.2) responses.
    """
    try:
        # New style: ChatResponse object
        return response.message.content
    except AttributeError:
        pass
    try:
        # Old style: plain dict
        return response["message"]["content"]
    except (KeyError, TypeError):
        return str(response)


# ── Prompt building ───────────────────────────────────────────────────────────

def _charger_context(charger: dict) -> str:
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


def build_messages(system_prompt: str, history: list[ChatMessage], prompt: str) -> list[dict]:
    msgs = [{"role": "system", "content": system_prompt}]
    trimmed = history[-(MAX_HISTORY_TURNS * 2):]
    for msg in trimmed:
        msgs.append({"role": msg.role, "content": msg.content})
    msgs.append({"role": "user", "content": prompt})
    return msgs


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/ask")
async def ask_question(data: PromptRequest):
    """Non-streaming endpoint — used by the eval harness."""
    result   = find_nearest_chargers(data.lat, data.lng, prompt=data.prompt)
    chargers = result["chargers"]
    filters  = result["filters_applied"]

    system_prompt = build_system_prompt(chargers, filters)
    messages      = build_messages(system_prompt, data.history, data.prompt)

    response = await asyncio.to_thread(ollama.chat, model=data.model, messages=messages)

    return {
        "answer":   _get_content(response),
        "chargers": chargers,
    }


@app.post("/ask/stream")
async def ask_stream(data: PromptRequest):
    """
    True streaming endpoint — SSE events: chargers → tokens → done.

    Uses a thread + queue pattern so tokens are yielded to the client
    as they are generated by Ollama, not batched after full completion.
    """
    result   = find_nearest_chargers(data.lat, data.lng, prompt=data.prompt)
    chargers = result["chargers"]
    filters  = result["filters_applied"]

    system_prompt = build_system_prompt(chargers, filters)
    messages      = build_messages(system_prompt, data.history, data.prompt)

    # Sentinel object signals that the producer thread has finished
    _DONE = object()

    token_queue: queue.Queue = queue.Queue()

    def _produce():
        """Run in a background thread — pushes tokens into the queue as generated."""
        try:
            for chunk in ollama.chat(model=data.model, messages=messages, stream=True):
                try:
                    token = chunk.message.content  # new-style
                except AttributeError:
                    token = chunk["message"]["content"]  # old-style
                if token:
                    token_queue.put(token)
        except Exception as exc:
            token_queue.put(exc)
        finally:
            token_queue.put(_DONE)

    async def generate():
        # Map data goes first so the map updates immediately
        yield f"data: {json.dumps({'type': 'chargers', 'chargers': chargers})}\n\n"

        # Start the Ollama inference in a background thread
        producer = threading.Thread(target=_produce, daemon=True)
        producer.start()

        while True:
            # Poll the queue without blocking the event loop
            try:
                item = await asyncio.get_event_loop().run_in_executor(
                    None, token_queue.get
                )
            except Exception as exc:
                yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"
                break

            if item is _DONE:
                break
            if isinstance(item, Exception):
                yield f"data: {json.dumps({'type': 'error', 'message': str(item)})}\n\n"
                break

            yield f"data: {json.dumps({'type': 'token', 'token': item})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Structured (anti-hallucination) endpoint ──────────────────────────────────

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
    """Two-phase anti-hallucination endpoint."""
    parse_response = await asyncio.to_thread(
        ollama.chat,
        model=data.model,
        messages=[
            {"role": "system", "content": PARSE_SYSTEM},
            {"role": "user",   "content": data.prompt},
        ],
    )

    raw_json = _get_content(parse_response).strip()
    raw_json = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_json, flags=re.MULTILINE).strip()

    parsed_action: dict = {}
    parse_error: str | None = None
    try:
        parsed_action = json.loads(raw_json)
    except json.JSONDecodeError as e:
        parse_error = str(e)

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
    for msg in data.history[-(MAX_HISTORY_TURNS * 2):]:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": data.prompt})

    narrate_response = await asyncio.to_thread(ollama.chat, model=data.model, messages=messages)

    return {
        "answer":          _get_content(narrate_response),
        "chargers":        chargers,
        "parsed_action":   parsed_action,
        "parse_error":     parse_error,
        "filters_applied": filters,
    }


@app.get("/health")
async def health_check():
    try:
        models_response = await asyncio.to_thread(ollama.list)
        raw_models = (
            models_response.get("models", [])
            if isinstance(models_response, dict)
            else getattr(models_response, "models", [])
        )
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
    return _ALL_CHARGERS


@app.get("/eval-results")
async def get_eval_results():
    if not _EVAL_RESULTS_PATH.exists():
        return {"error": "No eval results found. Run: python eval.py"}
    with open(_EVAL_RESULTS_PATH) as f:
        return json.load(f)
