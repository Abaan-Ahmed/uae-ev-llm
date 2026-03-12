import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"

// Global styles
import "./styles/index.css"

// Leaflet map styles
import "leaflet/dist/leaflet.css"

// Optional: smoother UI rendering in modern browsers
import { StrictMode } from "react"

const rootElement = document.getElementById("root")

if (!rootElement) {
  throw new Error("Root element not found")
}

const root = ReactDOM.createRoot(rootElement)

root.render(
  <StrictMode>
    <App />
  </StrictMode>
)