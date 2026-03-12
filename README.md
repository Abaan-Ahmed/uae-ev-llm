
# UAE EV Charging Intelligence LLM

An AI-powered application that integrates **Large Language Models (LLMs)** with **real-world EV charging infrastructure data in the UAE**.  
The system allows users to ask natural language questions about EV charging stations while visualizing the infrastructure on an interactive map.

This project was developed as part of a **research collaboration between the American University in Dubai (AUD) and the University of Washington**, focusing on experimentation with **local LLM deployment, retrieval systems, and AI interfaces**.

---

# Project Overview

The goal of this project is to explore how **local LLMs can be integrated with real datasets** to build intelligent applications.

The system combines:

- Local LLM inference using **Ollama**
- A **FastAPI backend**
- A **React + Vite frontend**
- **Open Charge Map EV infrastructure data**
- An **interactive map visualization**

Users can interact with the system through a chat interface and ask questions such as:

- "Where can I charge near Dubai Marina?"
- "How many EV chargers are in the UAE?"
- "Are there fast chargers in Abu Dhabi?"

The AI assistant responds while the map displays the EV infrastructure.

---

# System Architecture

Frontend:
- React
- Vite
- TailwindCSS
- React Leaflet (Map)

Backend:
- Python
- FastAPI
- Ollama API

AI Layer:
- Local LLMs (Llama3, Mistral, Gemma, Phi)

Data Layer:
- Open Charge Map API
- Local JSON EV charger dataset

Visualization:
- OpenStreetMap
- Leaflet interactive map

---

# Key Features

## AI Chat Assistant

Users can interact with a locally running LLM that understands questions about EV charging infrastructure.

Features:

- Streaming AI responses
- ChatGPT-style interface
- Typing indicator
- Multiple LLM support

Supported models:

- Llama3
- Mistral
- Gemma
- Phi

---

## Interactive EV Charging Map

The application includes an interactive map showing EV charging stations across the UAE.

Features:

- Real EV charger data
- OpenStreetMap visualization
- Popup information for each station
- Automatic data loading from backend

---

## Real EV Infrastructure Dataset

The system downloads EV charger data from:

Open Charge Map API

Example dataset entry:

{
  "name": "Al Yash Street",
  "lat": 24.06220367577066,
  "lng": 52.624910059494596
}

---

# Project Structure

uae-ev-llm/

backend/
- main.py
- fetch_ev_data.py
- vector_db.py
- retriever.py
- uae_ev_chargers.json

frontend/
- index.html
- package.json
- src/

src/
- main.jsx
- App.jsx
- styles/index.css

components/
- Sidebar.jsx
- Chat.jsx
- Message.jsx
- PromptBox.jsx
- EVMap.jsx

api/
- llmApi.js

---

# Hardware Used

Development machine:

Laptop: ASUS TUF Gaming F15  
CPU: Intel Core i7-12700H  
GPU: NVIDIA RTX 4070 Laptop GPU  
RAM: 16GB  
Storage: 1TB SSD

This hardware enables **local LLM inference using Ollama**.

---

# Backend Setup

cd backend

pip install fastapi uvicorn ollama chromadb sentence-transformers

Run backend:

uvicorn main:app --reload

Backend URL:

http://localhost:8000

---

# Fetch EV Data

python fetch_ev_data.py

This downloads EV charging stations from Open Charge Map.

---

# Frontend Setup

cd frontend

npm install

npm run dev

Frontend URL:

http://localhost:5173

---

# Running Ollama

Install Ollama:

https://ollama.com

Run a model:

ollama run llama3

You can also use:

ollama run mistral  
ollama run gemma  
ollama run phi

---

# API Endpoints

POST /ask

Send prompt to LLM.

Example:

{
  "prompt": "Where can I charge near Dubai Marina?",
  "model": "llama3"
}

---

GET /chargers

Returns EV charger dataset.

Example:

[
  {
    "name": "Dubai Mall Charger",
    "lat": 25.1972,
    "lng": 55.2744
  }
]

---

# Future Improvements

- Retrieval-Augmented Generation (RAG)
- Map highlighting based on AI responses
- Charger clustering
- Distance-based charger search
- EV route planning

---

# Contributors

Abaan Ahmed  
Mohammed Almuzaki  
Mohammad Almheiri  

Supervisor:

Dr. Muhammad Fahad Zia

Research Collaboration:

Dr. Eyhab Al-Masri & Mansur  
University of Washington

---

# License

Academic research project.
