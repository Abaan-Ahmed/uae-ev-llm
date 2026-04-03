from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pathlib import Path
import ollama
import json
import re

from charger_search import find_nearest_chargers

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: str
    content: str


class PromptRequest(BaseModel):
    prompt: str
    model: str
    lat: float
    lng: float
    history: list[ChatMessage] = []


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

    return f"""You are an EV charging assistant for the UAE.

Nearby chargers matching the user's request:
{charger_context}
{filter_summary}{fallback_note}

Guidelines:
- Recommend the most suitable chargers based on the user's question.
- Mention charger type (AC/DC), power, and connectors when relevant.
- Be concise and friendly. If the user asked for something specific (e.g. fast charger, Tesla), confirm whether results match.
- You have access to conversation history — reference prior context when relevant.
"""


def build_messages(system_prompt: str, history: list[ChatMessage], prompt: str) -> list[dict]:
    msgs = [{"role": "system", "content": system_prompt}]
    for msg in history:
        msgs.append({"role": msg.role, "content": msg.content})
    msgs.append({"role": "user", "content": prompt})
    return msgs


# Non-streaming endpoint (kept for compatibility)
@app.post("/ask")
async def ask_question(data: PromptRequest):
    result = find_nearest_chargers(data.lat, data.lng, prompt=data.prompt)
    chargers = result["chargers"]
    filters = result["filters_applied"]

    system_prompt = build_system_prompt(chargers, filters)
    messages = build_messages(system_prompt, data.history, data.prompt)

    response = ollama.chat(model=data.model, messages=messages)

    return {
        "answer": response["message"]["content"],
        "chargers": chargers,
    }


# Streaming endpoint
@app.post("/ask/stream")
async def ask_stream(data: PromptRequest):
    result = find_nearest_chargers(data.lat, data.lng, prompt=data.prompt)
    chargers = result["chargers"]
    filters = result["filters_applied"]

    system_prompt = build_system_prompt(chargers, filters)
    messages = build_messages(system_prompt, data.history, data.prompt)

    async def generate():
        # Send charger data first so the map updates immediately
        yield f"data: {json.dumps({'type': 'chargers', 'chargers': chargers})}\n\n"

        try:
            stream = ollama.chat(model=data.model, messages=messages, stream=True)
            for chunk in stream:
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


# Health check — tells frontend if Ollama is reachable and which models are installed
@app.get("/health")
def health_check():
    try:
        models_response = ollama.list()
        model_names = [m["name"] for m in models_response.get("models", [])]
        return {"status": "ok", "models": model_names}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# Endpoint for map to load ALL chargers
@app.get("/chargers")
def get_chargers():
    with open("uae_ev_chargers.json", "r") as f:
        chargers = json.load(f)
    return chargers


# ── Structured output endpoint ────────────────────────────────────────────────
# Two-phase approach:
#   1. LLM parses the user's intent → JSON action descriptor (no charger data yet)
#   2. Backend executes the action (pure code) → guaranteed real results
#   3. LLM narrates the backend results → response grounded in real data
#
# This eliminates hallucination: the LLM never invents charger names;
# it only narrates results the backend has already verified.

PARSE_SYSTEM = """You are a query parser for a UAE EV charging assistant.
Parse the user's query into a JSON object only — no other text, no markdown.

Return exactly this shape:
{
  "fast_only": true | false | null,
  "operator": "Tesla" | "ADNOC" | "DEWA" | null,
  "city": "Dubai" | "Abu Dhabi" | "Sharjah" | "Ajman" | "Ras Al Khaimah" | "Fujairah" | "Al Ain" | null,
  "min_power_kw": <number> | null,
  "connector": "CCS2" | "CHAdeMO" | "Type 2" | null,
  "intent_summary": "<one sentence describing what the user wants>"
}

Rules:
- If the user says "fast", "quick", "rapid", "DC", "supercharger" → fast_only: true
- If the user says "slow", "AC", "overnight", "level 2" → fast_only: false
- If the user names a specific city → set city
- If the user names a kW value → set min_power_kw
- All unknown fields must be null (not omitted)
"""


@app.post("/ask/structured")
async def ask_structured(data: PromptRequest):
    """
    Structured-output endpoint. Uses a two-phase LLM call to completely
    prevent hallucination:
      Phase 1 – LLM returns JSON action (no charger knowledge involved)
      Phase 2 – Backend runs the action; LLM only narrates verified results
    """

    # ── Phase 1: Parse intent ────────────────────────────────────────────────
    parse_response = ollama.chat(
        model=data.model,
        messages=[
            {"role": "system", "content": PARSE_SYSTEM},
            {"role": "user",   "content": data.prompt},
        ],
    )

    raw_json = parse_response["message"]["content"].strip()
    # Strip markdown fences if the model wraps in ```json ... ```
    raw_json = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_json, flags=re.MULTILINE).strip()

    parsed_action = {}
    parse_error   = None
    try:
        parsed_action = json.loads(raw_json)
    except json.JSONDecodeError as e:
        parse_error = str(e)
        # Fall back to a plain search if parsing fails
        parsed_action = {}

    # ── Phase 2: Backend executes using parsed filters ───────────────────────
    # Build a synthetic query string from the parsed action so charger_search
    # can apply its keyword filters even without the original prompt text.
    synthetic_query = data.prompt  # start with original
    if parsed_action.get("fast_only"):
        synthetic_query += " fast charger"
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

    # ── Phase 3: LLM narrates verified results ───────────────────────────────
    charger_context = "\n".join(_charger_context(c) for c in chargers)
    intent_summary  = parsed_action.get("intent_summary", data.prompt)

    narrate_system = f"""You are an EV charging assistant for the UAE.
The backend has already found these verified chargers matching the user's request.
DO NOT mention any chargers outside this list.

{charger_context}

User's intent: {intent_summary}

Write a helpful, concise response explaining the best options from the list above.
Include charger type, power, and distance where relevant.
"""

    messages = [{"role": "system", "content": narrate_system}]
    for msg in data.history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": data.prompt})

    narrate_response = ollama.chat(model=data.model, messages=messages)

    return {
        "answer":         narrate_response["message"]["content"],
        "chargers":       chargers,
        "parsed_action":  parsed_action,
        "parse_error":    parse_error,
        "filters_applied": filters,
    }


# Serve the latest eval results so the frontend dashboard can read them
@app.get("/eval-results")
def get_eval_results():
    results_path = Path(__file__).parent / "eval_results.json"
    if not results_path.exists():
        return {"error": "No eval results found. Run: python eval.py"}
    with open(results_path) as f:
        return json.load(f)
