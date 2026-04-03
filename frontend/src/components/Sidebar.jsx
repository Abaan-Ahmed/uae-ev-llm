import { useState, useEffect } from "react"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"

const TABS = [
  { id: "chat", icon: "💬", label: "Chat" },
  { id: "eval", icon: "📊", label: "Evaluation" },
]

function Sidebar({ model, setModel, activeTab, setActiveTab }) {
  const [ollamaStatus, setOllamaStatus]     = useState("checking")
  const [installedModels, setInstalledModels] = useState([])

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "ok") {
          setOllamaStatus("connected")
          setInstalledModels(data.models ?? [])
        } else {
          setOllamaStatus("error")
        }
      })
      .catch(() => setOllamaStatus("error"))
  }, [])

  const STATUS = {
    checking:  { dot: "bg-yellow-400 animate-pulse", label: "Checking Ollama…" },
    connected: { dot: "bg-green-400 animate-pulse",  label: "Ollama Connected" },
    error:     { dot: "bg-red-400",                  label: "Ollama Offline" },
  }
  const status = STATUS[ollamaStatus]

  return (
    <div className="w-72 h-full bg-gradient-to-b from-slate-900 to-slate-800 text-white flex flex-col shadow-xl">
      {/* Header */}
      <div className="px-6 py-6 border-b border-slate-700">
        <h1 className="text-2xl font-semibold tracking-tight">⚡ EV AI Lab</h1>
        <p className="text-sm text-slate-400 mt-1">UAE Charging Intelligence</p>
      </div>

      {/* Navigation tabs */}
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="flex flex-col gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition text-left ${
                activeTab === t.id
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:bg-slate-700 hover:text-white"
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Controls — only shown on chat tab */}
      {activeTab === "chat" && (
        <div className="flex flex-col gap-6 px-6 py-6">
          {/* Model selector */}
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Model</p>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            >
              <option value="llama3">Llama3</option>
              <option value="mistral">Mistral</option>
              <option value="phi">Phi</option>
              <option value="gemma">Gemma</option>
            </select>
            {ollamaStatus === "connected" && installedModels.length > 0 && (
              <p className="text-xs text-slate-500 mt-1.5">
                Installed: {installedModels.slice(0, 3).join(", ")}
              </p>
            )}
            {ollamaStatus === "error" && (
              <p className="text-xs text-red-400 mt-1.5">
                Run:{" "}
                <code className="bg-slate-700 px-1.5 py-0.5 rounded font-mono">
                  ollama serve
                </code>
              </p>
            )}
          </div>

          {/* Dataset */}
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Dataset</p>
            <div className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm flex items-center justify-between">
              <span>UAE EV Chargers</span>
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Active</span>
            </div>
          </div>

          {/* Prompt tips */}
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Try asking</p>
            <div className="space-y-2">
              {[
                "Fast charger near me",
                "Tesla Supercharger Dubai",
                "CCS2 charger in Abu Dhabi",
                "ADNOC chargers nearby",
              ].map((tip) => (
                <div
                  key={tip}
                  className="text-xs text-slate-400 bg-slate-700/50 rounded-lg px-3 py-2 italic leading-relaxed"
                >
                  "{tip}"
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Eval tab info */}
      {activeTab === "eval" && (
        <div className="px-6 py-6">
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-3">Run Evaluation</p>
          <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-green-400 space-y-1">
            <p className="text-slate-500"># All models, all queries:</p>
            <p>python eval.py</p>
            <p className="text-slate-500 mt-2"># Specific models:</p>
            <p>python eval.py \</p>
            <p className="pl-2">--models llama3 mistral</p>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Results are served at <code className="bg-slate-700 px-1 rounded">/eval-results</code> and displayed here automatically.
          </p>
        </div>
      )}

      <div className="flex-grow" />

      {/* Status footer */}
      <div className="px-6 py-4 border-t border-slate-700">
        <div className="flex items-center gap-2 text-sm">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status.dot}`} />
          {status.label}
        </div>
        <p className="text-xs text-slate-500 mt-1">Local LLM Runtime</p>
      </div>
    </div>
  )
}

export default Sidebar
