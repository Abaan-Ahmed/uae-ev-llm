from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
import ollama
import json

app = FastAPI()

# Allow frontend (React) to connect
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


# Streaming response from Ollama
def stream_llm(prompt, model):

    response = ollama.chat(
        model=model,
        messages=[
            {
                "role": "system",
                "content": "You are an EV charging expert for UAE."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        stream=True
    )

    for chunk in response:
        if "message" in chunk:
            yield chunk["message"]["content"]


# LLM endpoint
@app.post("/ask")
async def ask_question(data: PromptRequest):

    return StreamingResponse(
        stream_llm(data.prompt, data.model),
        media_type="text/plain"
    )


# EV charger dataset endpoint
@app.get("/chargers")
def get_chargers():

    with open("uae_ev_chargers.json", "r") as f:
        chargers = json.load(f)

    return chargers