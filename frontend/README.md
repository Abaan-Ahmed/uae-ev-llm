
# UAE EV Charging Intelligence — Frontend

This repository contains the **frontend interface** for the UAE EV Charging Intelligence system.  
The frontend provides a modern AI chat interface combined with an interactive EV charging map for the United Arab Emirates.

The interface allows users to:

- Ask questions about EV charging infrastructure
- Interact with a local Large Language Model (LLM)
- Visualize EV charging stations on an interactive map
- Explore UAE charging infrastructure through a clean AI dashboard

The frontend communicates with a **FastAPI backend** and a **local LLM runtime powered by Ollama**.

---

# Technologies Used

### Core Framework
- React
- Vite

### Styling
- TailwindCSS

### Map Visualization
- React Leaflet
- OpenStreetMap

### AI Communication
- Streaming API connection to FastAPI backend

---

# Key Features

## AI Chat Interface

The frontend includes a modern chat interface similar to ChatGPT.

Features:

- Streaming AI responses
- Typing indicator
- Message bubbles for user and AI
- Keyboard shortcuts:
  - Enter → send message
  - Shift + Enter → new line

Users can ask questions such as:

• Where can I charge near Dubai Marina?  
• Are there fast chargers in Abu Dhabi?  
• How many EV chargers are in the UAE?

---

## Interactive EV Charging Map

The application includes a real-time map showing EV charging stations across the UAE.

Features:

- Map powered by OpenStreetMap
- Charger markers displayed using Leaflet
- Popup information for each charger
- Charger dataset loaded from backend API

---

## Model Selector

Users can switch between locally installed LLMs.

Supported models:

- Llama3
- Mistral
- Gemma
- Phi

The model is selected in the sidebar and used when sending prompts to the backend.

---

# Project Structure

frontend/

├── index.html  
├── package.json  
└── src/

src/

├── main.jsx  
├── App.jsx  

├── styles/
│   └── index.css  

├── components/
│   ├── Sidebar.jsx
│   ├── Chat.jsx
│   ├── Message.jsx
│   ├── PromptBox.jsx
│   └── EVMap.jsx

├── api/
│   └── llmApi.js

---

# Installation

Navigate to the frontend directory:

cd frontend

Install dependencies:

npm install

---

# Running the Application

Start the development server:

npm run dev

The application will run at:

http://localhost:5173

---

# Backend Requirement

The frontend expects a backend running at:

http://localhost:8000

Required backend endpoints:

POST /ask  
Handles AI prompt requests

GET /chargers  
Returns EV charger locations

---

# Map Data

The map loads EV charger locations from the backend dataset.

Each charger contains:

- name
- latitude
- longitude

Example:

{
  "name": "Dubai Mall Charger",
  "lat": 25.1972,
  "lng": 55.2744
}

---

# UI Components

### Sidebar

Displays:

- Model selector
- Dataset information
- System status

---

### Chat

Handles:

- message history
- streaming responses
- typing indicator

---

### PromptBox

User input area.

Features:

- auto-growing textarea
- send button
- keyboard shortcuts

---

### EVMap

Interactive Leaflet map displaying charger locations.

---

# Future Improvements

Potential frontend enhancements:

- Map marker clustering
- Charger highlighting based on AI responses
- Dark mode
- Mobile responsive layout
- Map search and filters

---

# Development Environment

Recommended environment:

Node.js 18+

Dependencies installed using npm.

---

# Authors

Abaan Ahmed  
Mohammed Almuzaki  
Mohammad Almheiri

American University in Dubai
