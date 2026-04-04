import { StrictMode } from "react"
import ReactDOM from "react-dom/client"
import App from "./App"

// Global styles
import "./styles/index.css"

// Leaflet map styles — imported once here, NOT repeated in EVMap.jsx
import "leaflet/dist/leaflet.css"

const rootElement = document.getElementById("root")
if (!rootElement) {
  throw new Error("Root element not found")
}

ReactDOM.createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
)
