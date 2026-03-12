from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import ollama
import json

from charger_search import find_nearest_chargers

app = FastAPI()

# Allow React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request format from frontend
class PromptRequest(BaseModel):
    prompt: str
    model: str
    lat: float
    lng: float


# LLM endpoint
@app.post("/ask")
async def ask_question(data: PromptRequest):

    # Find nearest chargers
    chargers = find_nearest_chargers(data.lat, data.lng)

    charger_context = ""

    for c in chargers:
        charger_context += f"{c['name']} ({round(c['distance'],2)} km)\n"

    system_prompt = f"""
You are an EV charging assistant for UAE.

Nearby chargers:
{charger_context}

Explain to the user which chargers are closest.
Be concise and helpful.
"""

    response = ollama.chat(
        model=data.model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": data.prompt},
        ],
    )

    return {
        "answer": response["message"]["content"],
        "chargers": chargers
    }


# Endpoint for map to load ALL chargers
@app.get("/chargers")
def get_chargers():

    with open("uae_ev_chargers.json", "r") as f:
        chargers = json.load(f)

    return chargers