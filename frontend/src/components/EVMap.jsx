import { useEffect, useState } from "react"
import {
  MapContainer, TileLayer, Marker, Popup,
  CircleMarker, Polyline, useMap,
} from "react-leaflet"
import MarkerClusterGroup from "react-leaflet-cluster"
import L from "leaflet"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"
const ORS_KEY = import.meta.env.VITE_ORS_KEY || "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjM3Y2RjODcyNmM3NTQyMzhhOGQyMmIwODA5ZjljYjFkIiwiaCI6Im11cm11cjY0In0="
const UAE_CENTER = { lat: 24.4539, lng: 54.3773 }

// Light CARTO Positron tiles — clean, minimal, fully visible
const LIGHT_TILES = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"

// Custom SVG marker icons — dark pins for light map background
function makeIcon(color, size = 28) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size+6}" viewBox="0 0 ${size} ${size+6}">
    <circle cx="${size/2}" cy="${size/2}" r="${size/2-1}" fill="${color}" stroke="white" stroke-width="2.5"/>
    <text x="${size/2}" y="${size/2+4}" text-anchor="middle" font-size="13" fill="white">⚡</text>
    <polygon points="${size/2-4},${size-2} ${size/2+4},${size-2} ${size/2},${size+5}" fill="${color}"/>
  </svg>`
  return L.divIcon({
    html: svg,
    iconSize: [size, size + 6],
    iconAnchor: [size / 2, size + 6],
    popupAnchor: [0, -(size + 6)],
    className: "",
  })
}

const defaultIcon   = makeIcon("#334155", 26)   // dark slate on light map
const highlightIcon = makeIcon("#10b981", 32)   // emerald accent for matched

const TYPE_COLORS = {
  "DC Fast":     { bg: "#fee2e2", border: "#fca5a5", text: "#b91c1c" },
  "AC Fast":     { bg: "#dbeafe", border: "#93c5fd", text: "#1d4ed8" },
  "AC Standard": { bg: "#dcfce7", border: "#86efac", text: "#15803d" },
}
const DEFAULT_TYPE_COLOR = { bg: "#f1f5f9", border: "#cbd5e1", text: "#475569" }

function MapZoom({ chargers }) {
  const map = useMap()
  useEffect(() => {
    if (!chargers?.length) return
    if (chargers.length === 1) {
      map.flyTo([chargers[0].lat, chargers[0].lng], 14, { duration: 1.2 })
    } else {
      const lats = chargers.map(c => c.lat)
      const lngs = chargers.map(c => c.lng)
      map.fitBounds(
        [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
        { padding: [50, 50], maxZoom: 14, duration: 1.2 }
      )
    }
  }, [chargers, map])
  return null
}

function ChargerPopup({ c }) {
  const tc = TYPE_COLORS[c.charger_type] || DEFAULT_TYPE_COLOR
  return (
    <div style={{ minWidth: 200, fontFamily: "'Sora', sans-serif" }}>
      <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "#0f172a" }}>
        {c.name}
      </p>
      {c.charger_type && (
        <span style={{
          display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 11,
          fontWeight: 600, marginBottom: 6, fontFamily: "'DM Mono', monospace",
          background: tc.bg, border: `1px solid ${tc.border}`, color: tc.text,
        }}>
          {c.charger_type}{c.power_kw ? ` · ${c.power_kw} kW` : ""}
        </span>
      )}
      {c.connectors?.length > 0 && (
        <p style={{ fontSize: 12, color: "#475569", marginBottom: 3 }}>
          🔌 {c.connectors.join(" · ")}
        </p>
      )}
      {c.operator && c.operator !== "Unknown" && (
        <p style={{ fontSize: 12, color: "#475569", marginBottom: 3 }}>🏢 {c.operator}</p>
      )}
      {c.num_connectors > 0 && (
        <p style={{ fontSize: 12, color: "#475569", marginBottom: 3 }}>
          ◉ {c.num_connectors} point{c.num_connectors !== 1 ? "s" : ""}
        </p>
      )}
      {c.distance != null && (
        <p style={{ fontSize: 12, fontWeight: 700, color: "#10b981", marginTop: 6, fontFamily: "'DM Mono', monospace" }}>
          {c.distance} km away
        </p>
      )}
    </div>
  )
}

function EVMap({ highlightedChargers }) {
  const [chargers, setChargers]               = useState([])
  const [userLocation, setUserLocation]       = useState(null)
  const [locationFallback, setLocationFallback] = useState(false)
  const [route, setRoute]                     = useState(null)
  const [filterType, setFilterType]           = useState("all")

  useEffect(() => {
    fetch(`${API_URL}/chargers`)
      .then(r => r.json())
      .then(setChargers)
      .catch(err => console.error("Failed to load chargers:", err))
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) {
      setUserLocation(UAE_CENTER); setLocationFallback(true); return
    }
    navigator.geolocation.getCurrentPosition(
      pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { setUserLocation(UAE_CENTER); setLocationFallback(true) },
      { timeout: 6000 }
    )
  }, [])

  useEffect(() => {
    if (!userLocation || !highlightedChargers?.length) { setRoute(null); return }
    const c = highlightedChargers[0]
    fetch(`https://api.openrouteservice.org/v2/directions/driving-car?api_key=${ORS_KEY}&start=${userLocation.lng},${userLocation.lat}&end=${c.lng},${c.lat}`)
      .then(r => r.json())
      .then(d => {
        const coords = d.features?.[0]?.geometry?.coordinates
        if (coords) setRoute(coords.map(p => [p[1], p[0]]))
      })
      .catch(() => setRoute(null))
  }, [highlightedChargers, userLocation])

  const highlightedKeys = new Set(highlightedChargers?.map(c => `${c.lat},${c.lng}`) ?? [])

  const visibleChargers = chargers.filter(c => {
    if (highlightedKeys.has(`${c.lat},${c.lng}`)) return false
    if (filterType === "fast") return c.is_fast_charger
    if (filterType === "ac") return !c.is_fast_charger
    return true
  })

  const FILTERS = [
    { id: "all", label: "All" },
    { id: "fast", label: "⚡ Fast" },
    { id: "ac", label: "○ AC" },
  ]

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg-surface)" }}>
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface)" }}
      >
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Charging Map
          </h2>
          <p className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "'DM Mono', monospace" }}>
            {locationFallback ? "📍 UAE center" : "📍 live location"} · {chargers.length} stations
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {highlightedChargers?.length > 0 && (
            <span
              className="text-xs px-2 py-1 rounded-lg font-medium"
              style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid var(--border-accent)", fontFamily: "'DM Mono', monospace" }}
            >
              {highlightedChargers.length} matched
            </span>
          )}
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className="text-xs px-2 py-1 rounded-lg transition-all"
              style={
                filterType === f.id
                  ? { background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid var(--border-accent)" }
                  : { color: "var(--text-muted)", border: "1px solid var(--border)", background: "transparent" }
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1">
        <MapContainer
          center={[24.4, 54.3]}
          zoom={7}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url={LIGHT_TILES}
          />

          <MapZoom chargers={highlightedChargers} />

          {/* User dot */}
          {userLocation && (
            <CircleMarker
              center={[userLocation.lat, userLocation.lng]}
              radius={8}
              pathOptions={{
                color: locationFallback ? "#f59e0b" : "#10b981",
                fillColor: locationFallback ? "#f59e0b" : "#10b981",
                fillOpacity: 0.9,
                weight: 3,
              }}
            >
              <Popup>
                <div style={{ fontFamily: "'Sora', sans-serif", color: "#0f172a", fontSize: 13, fontWeight: 600 }}>
                  {locationFallback ? "📍 UAE Center (approx)" : "📍 Your Location"}
                </div>
              </Popup>
            </CircleMarker>
          )}

          {/* Route */}
          {route && (
            <Polyline
              positions={route}
              pathOptions={{ color: "#10b981", weight: 4, opacity: 0.8, dashArray: "10, 6" }}
            />
          )}

          {/* All chargers clustered */}
          <MarkerClusterGroup chunkedLoading>
            {visibleChargers.map((c, i) => (
              <Marker key={"all-" + i} position={[c.lat, c.lng]} icon={defaultIcon}>
                <Popup><ChargerPopup c={c} /></Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>

          {/* Highlighted chargers */}
          {highlightedChargers?.map((c, i) => (
            <Marker key={"hl-" + i} position={[c.lat, c.lng]} icon={highlightIcon}>
              <Popup><ChargerPopup c={c} /></Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}

export default EVMap
