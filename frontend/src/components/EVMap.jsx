import { useEffect, useState } from "react"
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  Polyline,
  useMap
} from "react-leaflet"

import L from "leaflet"
import polyline from "@mapbox/polyline"
import "leaflet/dist/leaflet.css"


// Icons
const defaultIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41]
})

const highlightIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41]
})


// Auto zoom
function MapZoom({ chargers }) {

  const map = useMap()

  useEffect(() => {

    if (!chargers || chargers.length === 0) return

    const first = chargers[0]

    map.flyTo([first.lat, first.lng], 13)

  }, [chargers])

  return null
}



function EVMap({ highlightedChargers }) {

  const [chargers, setChargers] = useState([])
  const [userLocation, setUserLocation] = useState(null)
  const [route, setRoute] = useState(null)


  // Load chargers
  useEffect(() => {

    fetch("http://localhost:8000/chargers")
      .then(res => res.json())
      .then(data => setChargers(data))

  }, [])


  // Get user location
  useEffect(() => {

    navigator.geolocation.getCurrentPosition((position) => {

      setUserLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude
      })

    })

  }, [])



  // Fetch route when charger found
  useEffect(() => {

    if (!userLocation || !highlightedChargers || highlightedChargers.length === 0)
      return

    const charger = highlightedChargers[0]

    const start = `${userLocation.lng},${userLocation.lat}`
    const end = `${charger.lng},${charger.lat}`

    const API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjM3Y2RjODcyNmM3NTQyMzhhOGQyMmIwODA5ZjljYjFkIiwiaCI6Im11cm11cjY0In0="

    fetch(
      `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${API_KEY}&start=${start}&end=${end}`
    )
      .then(res => res.json())
      .then(data => {

        const encoded = data.features[0].geometry.coordinates

        const decoded = encoded.map(coord => [coord[1], coord[0]])

        setRoute(decoded)

      })
      .catch(err => console.error(err))

  }, [highlightedChargers, userLocation])



  return (

    <div className="flex flex-col h-full bg-white border-l border-gray-200">

      <div className="px-6 py-4 border-b bg-white flex justify-between">

        <div>
          <h2 className="font-semibold text-lg">UAE EV Charging Map</h2>
          <p className="text-xs text-gray-500">Live infrastructure</p>
        </div>

        <div className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full">
          {chargers.length} Chargers
        </div>

      </div>


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


          {/* USER LOCATION */}
          {userLocation && (
            <CircleMarker
              center={[userLocation.lat, userLocation.lng]}
              radius={10}
              pathOptions={{ color: "blue" }}
            >
              <Popup>📍 Your Location</Popup>
            </CircleMarker>
          )}


          {/* ROUTE */}
          {route && (
            <Polyline
              positions={route}
              pathOptions={{ color: "blue", weight: 4 }}
            />
          )}


          {/* ALL CHARGERS */}
          {chargers.map((c, i) => (
            <Marker
              key={"all-" + i}
              position={[c.lat, c.lng]}
              icon={defaultIcon}
            >
              <Popup>⚡ {c.name}</Popup>
            </Marker>
          ))}


          {/* HIGHLIGHTED CHARGERS */}
          {highlightedChargers?.map((c, i) => (
            <Marker
              key={"highlight-" + i}
              position={[c.lat, c.lng]}
              icon={highlightIcon}
            >
              <Popup>
                ⚡ <strong>{c.name}</strong>
                <br />
                Distance: {c.distance?.toFixed(2)} km
              </Popup>
            </Marker>
          ))}

        </MapContainer>

      </div>

    </div>
  )
}

export default EVMap