# UAE EV Charging Assistant ⚡🇦🇪

## Overview

This project is a **UAE Electric Vehicle (EV) Charging Assistant** built
using:

-   **Python**
-   **FastAPI**
-   **Ollama (Local LLM inference)**
-   **OpenChargeMap API**
-   **JSON dataset of EV chargers in the UAE**

The system collects EV charging station data from the **OpenChargeMap
API**, stores it locally as a dataset, and exposes APIs that allow:

1.  Retrieving EV charger locations in the UAE
2.  Asking an AI assistant questions about EV charging in the UAE using
    a local LLM

This project is designed to be used with a **React frontend** and a
**local Ollama model**.

------------------------------------------------------------------------

# Project Architecture

The system consists of **three main components**:

### 1️⃣ Data Collection Script

Fetches EV charger locations from OpenChargeMap.

File:

    fetch_ev_data.py

Responsibilities:

-   Connects to OpenChargeMap API
-   Downloads EV charging locations in the UAE
-   Extracts relevant information
-   Saves results into a JSON dataset

Output:

    uae_ev_chargers.json

------------------------------------------------------------------------

### 2️⃣ FastAPI Backend

File:

    main.py

Responsibilities:

-   Serves charger location data
-   Connects to local Ollama LLM
-   Streams AI responses
-   Allows React frontend communication

------------------------------------------------------------------------

### 3️⃣ Local Dataset

File:

    uae_ev_chargers.json

Contains EV charging station locations with:

    {
      "name": "Tesla Supercharger Dubai",
      "lat": 25.199541,
      "lng": 55.283352
    }

------------------------------------------------------------------------

# Folder Structure

Example project structure:

    backend/
    │
    ├── fetch_ev_data.py        # Script to download EV chargers
    ├── main.py                 # FastAPI backend
    ├── uae_ev_chargers.json    # Local charger dataset
    └── __pycache__/            # Python cache (ignored in git)

------------------------------------------------------------------------

# Features

### EV Charger Dataset

-   Automatically downloaded from **OpenChargeMap**

-   Contains chargers across the UAE

-   Includes:

    -   Tesla Superchargers
    -   ADNOC chargers
    -   DEWA EV chargers
    -   Hotel chargers
    -   Mall chargers
    -   Public infrastructure chargers

------------------------------------------------------------------------

### AI Assistant

The AI assistant can answer questions such as:

-   Where can I charge my EV in Dubai?
-   Are there Tesla chargers in Abu Dhabi?
-   What charging networks exist in the UAE?
-   Are EV chargers available near malls?

The assistant uses **Ollama models locally**, which means:

✔ No external LLM API required\
✔ No usage cost\
✔ Works offline

------------------------------------------------------------------------

# Installation

## 1️⃣ Install Python

Requires **Python 3.9 or newer**.

Check version:

    python --version

------------------------------------------------------------------------

## 2️⃣ Install Dependencies

Install required Python packages:

    pip install fastapi uvicorn requests pydantic ollama

------------------------------------------------------------------------

## 3️⃣ Install Ollama

Download Ollama from:

https://ollama.com

Then install a model, for example:

    ollama pull llama3

Other supported models:

-   mistral
-   llama3
-   phi3
-   gemma

------------------------------------------------------------------------

# Step 1 --- Download EV Charger Dataset

Run the data collection script:

    python fetch_ev_data.py

This will:

1.  Connect to OpenChargeMap API
2.  Retrieve EV chargers in the UAE
3.  Save them into:

```{=html}
<!-- -->
```
    uae_ev_chargers.json

Example output:

    Downloaded 120 UAE EV chargers

------------------------------------------------------------------------

# Step 2 --- Run the Backend

Start the FastAPI server:

    uvicorn main:app --reload

Server will start at:

    http://127.0.0.1:8000

------------------------------------------------------------------------

# API Endpoints

## 1️⃣ Ask the AI Assistant

Endpoint:

    POST /ask

Example request:

    {
      "prompt": "Where can I charge my Tesla in Dubai?",
      "model": "llama3"
    }

Response:

Streaming AI-generated answer.

------------------------------------------------------------------------

## 2️⃣ Get EV Charger Dataset

Endpoint:

    GET /chargers

Returns:

    [
      {
        "name": "Tesla Supercharger Dubai",
        "lat": 25.199541,
        "lng": 55.283352
      }
    ]

Used by the frontend to display chargers on a **map**.

------------------------------------------------------------------------

# CORS Configuration

The backend allows requests from any frontend:

``` python
allow_origins=["*"]
```

This allows:

-   React
-   Vue
-   Angular
-   Mobile apps

to connect without restrictions.

------------------------------------------------------------------------

# Streaming AI Responses

The backend streams responses from Ollama.

This allows:

✔ Real-time responses\
✔ Faster UI updates\
✔ ChatGPT-style streaming

Example implementation:

    StreamingResponse(
        stream_llm(data.prompt, data.model),
        media_type="text/plain"
    )

------------------------------------------------------------------------

# Example Workflow

User asks:

> "Where can I charge my EV in Dubai?"

Process:

1️⃣ React frontend sends request to backend

2️⃣ Backend sends prompt to Ollama

3️⃣ Ollama generates response

4️⃣ Response streams back to frontend

------------------------------------------------------------------------

# Example Chargers in Dataset

Examples include:

-   Tesla Supercharger Dubai
-   ADNOC EV Charging Hub
-   Dubai Mall charging stations
-   Mall of the Emirates chargers
-   Yas Mall EV chargers
-   Al Ain EV chargers
-   Ras Al Khaimah chargers

Dataset includes locations across:

-   Dubai
-   Abu Dhabi
-   Sharjah
-   Ajman
-   Fujairah
-   Ras Al Khaimah
-   Al Ain

------------------------------------------------------------------------

# Potential Improvements

Possible extensions for this project:

### Add Distance Search

Find nearest charger to user location.

------------------------------------------------------------------------

### Add Map Integration

Integrate with:

-   Google Maps
-   Mapbox
-   Leaflet

------------------------------------------------------------------------

### Add Charger Details

Include:

-   Charging speed
-   Connector types
-   Availability status

------------------------------------------------------------------------

### AI + Dataset Integration

Improve the AI by allowing it to query the dataset directly.

Example:

User asks:

> "Find chargers near Dubai Mall"

System:

1️⃣ Search dataset\
2️⃣ Provide closest chargers\
3️⃣ Generate AI explanation

------------------------------------------------------------------------

# Security Notes

Current implementation uses:

    allow_origins=["*"]

For production deployments you should restrict this to:

    allow_origins=["http://localhost:3000"]

or your frontend domain.

------------------------------------------------------------------------

# License

This project uses data from:

OpenChargeMap

License:

Open Data Commons Open Database License (ODbL)

More information:

https://openchargemap.org

------------------------------------------------------------------------

# Author

Developed as part of an **EV Charging AI Assistant project for the
UAE**.
