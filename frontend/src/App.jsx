import { useState } from "react"
import Sidebar from "./components/Sidebar"
import Chat from "./components/Chat"
import EVMap from "./components/EVMap"
import EvalDashboard from "./components/EvalDashboard"

const TABS = [
  { id: "chat", label: "💬 Chat" },
  { id: "eval", label: "📊 Evaluation" },
]

function App() {
  const [model, setModel]                     = useState("llama3")
  const [highlightedChargers, setHighlightedChargers] = useState([])
  const [activeTab, setActiveTab]             = useState("chat")

  return (
    <div className="h-screen w-screen flex bg-gradient-to-br from-slate-100 to-slate-200 text-gray-900">
      {/* Sidebar */}
      <Sidebar model={model} setModel={setModel} activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {activeTab === "chat" && (
          <>
            {/* Chat panel */}
            <div className="flex flex-col flex-[1.2] bg-white shadow-inner">
              <Chat model={model} setHighlightedChargers={setHighlightedChargers} />
            </div>
            {/* Map panel */}
            <div className="flex-[1] border-l border-gray-200 bg-gray-50">
              <EVMap highlightedChargers={highlightedChargers} />
            </div>
          </>
        )}

        {activeTab === "eval" && (
          <div className="flex-1 overflow-hidden">
            <EvalDashboard />
          </div>
        )}
      </div>
    </div>
  )
}

export default App
