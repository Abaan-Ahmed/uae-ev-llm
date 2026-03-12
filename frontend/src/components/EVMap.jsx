import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import "leaflet/dist/leaflet.css"

function EVMap(){

  const [chargers, setChargers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(()=>{

    fetch("http://localhost:8000/chargers")
      .then(res => res.json())
      .then(data => {
        console.log("Chargers loaded:", data.length)
        setChargers(data)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })

  },[])

  return(

    <div className="flex flex-col h-full bg-white border-l border-gray-200">

      {/* Map Header */}
      <div className="px-6 py-4 border-b bg-white flex items-center justify-between">

        <div>
          <h2 className="font-semibold text-lg">
            UAE EV Charging Map
          </h2>

          <p className="text-xs text-gray-500">
            Live charging infrastructure data
          </p>
        </div>

        <div className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full">
          {chargers.length} Chargers
        </div>

      </div>

      {/* Map Container */}
      <div className="flex-1 relative">

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm bg-white z-10">
            Loading charger locations...
          </div>
        )}

        <MapContainer
          center={[24.4,54.3]}
          zoom={7}
          style={{height:"100%", width:"100%"}}
        >

          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {chargers.map((c,i)=>(
            <Marker key={i} position={[c.lat,c.lng]}>
              <Popup>
                ⚡ {c.name}
              </Popup>
            </Marker>
          ))}

        </MapContainer>

      </div>

    </div>

  )
}

export default EVMap