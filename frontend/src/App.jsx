import { useState } from "react"
import Sidebar from "./components/Sidebar"
import Chat from "./components/Chat"
import EVMap from "./components/EVMap"

function App() {

  const [model, setModel] = useState("llama3")

  return (
    <div className="h-screen w-screen flex bg-gradient-to-br from-slate-100 to-slate-200 text-gray-900">

      {/* Sidebar */}
      <Sidebar model={model} setModel={setModel} />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">

        {/* Chat Section */}
        <div className="flex flex-col flex-[1.2] bg-white shadow-inner">

          <Chat model={model} />

        </div>

        {/* Map Section */}
        <div className="flex-[1] border-l border-gray-200 bg-gray-50">

          <EVMap />

        </div>

      </div>

    </div>
  )
}

export default App