import { useEffect, useState } from "react"
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  Polyline,
  useMap,
} from "react-leaflet"
import MarkerClusterGroup from "react-leaflet-cluster"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"
const UAE_CENTER = { lat: 24.4539, lng: 54.3773 }

// ── Marker icons ─────────────────────────────────────────────────────────────
const defaultIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

const highlightIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png",
  iconSize: [30, 48],
  iconAnchor: [15, 48],
})

// ── Charger type badge colors ─────────────────────────────────────────────────
const TYPE_BADGE = {
  "DC Fast":      "background:#fee2e2;color:#b91c1c",
  "AC Fast":      "background:#dbeafe;color:#1d4ed8",
  "AC Standard":  "background:#dcfce7;color:#15803d",
}

// ── Map auto-zoom ─────────────────────────────────────────────────────────────
function MapZoom({ chargers }) {
  const map = useMap()
  useEffect(() => {
    if (!chargers?.length) return
    map.flyTo([chargers[0].lat, chargers[0].lng], 13, { duration: 1.2 })
  }, [chargers])
  return null
}

// ── Rich popup for a single charger ──────────────────────────────────────────
function ChargerPopup({ c }) {
  const badgeStyle = TYPE_BADGE[c.charger_type] || "background:#f3f4f6;color:#374151"
  return (
    <div style={{ minWidth: 190, fontFamily: "Inter, sans-serif", fontSize: 13 }}>
      <p style={{ fontWeight: 600, marginBottom: 6 }}>⚡ {c.name}</p>

      {c.charger_type && (
        <p style={{ marginBottom: 4 }}>
          <span style={{ padding: "1px 6px", borderRadius: 4, fontSize: 11, fontWeight: 500, ...Object.fromEntries(badgeStyle.split(";").map(s => s.split(":"))) }}>
            {c.charger_type}
          </span>
          {c.power_kw ? <span style={{ marginLeft: 4, color: "#6b7280" }}>{c.power_kw} kW</span> : null}
        </p>
      )}

      {c.connectors?.length > 0 && (
        <p style={{ color: "#6b7280", marginBottom: 2 }}>🔌 {c.connectors.join(" · ")}</p>
      )}
      {c.operator && c.operator !== "Unknown" && (
        <p style={{ color: "#6b7280", marginBottom: 2 }}>🏢 {c.operator}</p>
      )}
      {c.num_connectors > 0 && (
        <p style={{ color: "#6b7280", marginBottom: 2 }}>
          📍 {c.num_connectors} charging point{c.num_connectors !== 1 ? "s" : ""}
        </p>
      )}
      {c.distance != null && (
        <p style={{ color: "#2563eb", fontWeight: 500, marginTop: 4 }}>
          📏 {c.distance} km away
        </p>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
function EVMap({ highlightedChargers }) {
  const [chargers, setChargers] = useState([])
  const [userLocation, setUserLocation] = useState(null)
  const [locationFallback, setLocationFallback] = useState(false)
  const [route, setRoute] = useState(null)

  // Load all chargers from backend
  useEffect(() => {
    fetch(`${API_URL}/chargers`)
      .then((res) => res.json())
      .then((data) => setChargers(data))
      .catch((err) => console.error("Failed to load chargers:", err))
  }, [])

  // Get user location with graceful fallback to UAE center
  useEffect(() => {
    if (!navigator.geolocation) {
      setUserLocation(UAE_CENTER)
      setLocationFallback(true)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        setUserLocation(UAE_CENTER)
        setLocationFallback(true)
      },
      { timeout: 6000 }
    )
  }, [])

  // Fetch driving route to the nearest highlighted charger
  useEffect(() => {
    if (!userLocation || !highlightedChargers?.length) {
      setRoute(null)
      return
    }
    const charger = highlightedChargers[0]
    const start = `${userLocation.lng},${userLocation.lat}`
    const end = `${charger.lng},${charger.lat}`
    const ORS_KEY =
      "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjM3Y2RjODcyNmM3NTQyMzhhOGQyMmIwODA5ZjljYjFkIiwiaCI6Im11cm11cjY0In0="

    fetch(
      `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${ORS_KEY}&start=${start}&end=${end}`
    )
      .then((res) => res.json())
      .then((data) => {
        const coords = data.features?.[0]?.geometry?.coordinates
        if (coords) setRoute(coords.map((c) => [c[1], c[0]]))
      })
      .catch(() => setRoute(null))
  }, [highlightedChargers, userLocation])

  // Build a set of highlighted positions so we can exclude them from clustering
  const highlightedKeys = new Set(
    highlightedChargers?.map((c) => `${c.lat},${c.lng}`) ?? []
  )

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-white flex justify-between items-center">
        <div>
          <h2 className="font-semibold text-lg">UAE EV Charging Map</h2>
          <p className="text-xs text-gray-500">
            {locationFallback
              ? "📍 Using UAE center — location access denied"
              : "Live infrastructure"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {highlightedChargers?.length > 0 && (
            <div className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
              {highlightedChargers.length} matched
            </div>
          )}
          <div className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
            {chargers.length} Chargers
          </div>
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
            attribution="© OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapZoom chargers={highlightedChargers} />

          {/* User location dot */}
          {userLocation && (
            <CircleMarker
              center={[userLocation.lat, userLocation.lng]}
              radius={10}
              pathOptions={{
                color: locationFallback ? "#f59e0b" : "#3b82f6",
                fillColor: locationFallback ? "#fde68a" : "#93c5fd",
                fillOpacity: 0.85,
                weight: 2,
              }}
            >
              <Popup>
                {locationFallback
                  ? "📍 UAE Center (location unavailable)"
                  : "📍 Your Location"}
              </Popup>
            </CircleMarker>
          )}

          {/* Driving route */}
          {route && (
            <Polyline
              positions={route}
              pathOptions={{
                color: "#3b82f6",
                weight: 4,
                opacity: 0.75,
                dashArray: "8, 5",
              }}
            />
          )}

          {/* All chargers — clustered for readability */}
          <MarkerClusterGroup chunkedLoading>
            {chargers
              .filter((c) => !highlightedKeys.has(`${c.lat},${c.lng}`))
              .map((c, i) => (
                <Marker key={"all-" + i} position={[c.lat, c.lng]} icon={defaultIcon}>
                  <Popup>
                    <ChargerPopup c={c} />
                  </Popup>
                </Marker>
              ))}
          </MarkerClusterGroup>

          {/* Highlighted chargers — always visible, not clustered */}
          {highlightedChargers?.map((c, i) => (
            <Marker key={"hl-" + i} position={[c.lat, c.lng]} icon={highlightIcon}>
              <Popup>
                <ChargerPopup c={c} />
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}

export default EVMap
