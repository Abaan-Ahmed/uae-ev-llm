import { useState, useEffect } from "react"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"

const TABS = [
  { id: "chat", icon: "⚡", label: "Assistant" },
  { id: "eval", icon: "◈", label: "Evaluation" },
]

const MODELS = [
  { value: "llama3",  label: "Llama 3",  tag: "Meta"     },
  { value: "mistral", label: "Mistral",  tag: "Mistral"  },
  { value: "phi",     label: "Phi-3",    tag: "Microsoft"},
  { value: "gemma",   label: "Gemma",    tag: "Google"   },
]

const PROMPTS = [
  { icon: "⚡", text: "Fast charger near me" },
  { icon: "🔴", text: "Tesla Supercharger Dubai" },
  { icon: "🔌", text: "CCS2 charger in Abu Dhabi" },
  { icon: "🏢", text: "ADNOC chargers nearby" },
  { icon: "🚗", text: "Non-Tesla CCS2 charger" },
]

function Sidebar({ model, setModel, activeTab, setActiveTab, onPromptSelect, onClearChat }) {
  const [ollamaStatus, setOllamaStatus]       = useState("checking")
  const [installedModels, setInstalledModels] = useState([])

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then(r => r.json())
      .then(d => {
        setOllamaStatus(d.status === "ok" ? "connected" : "error")
        setInstalledModels(d.models ?? [])
      })
      .catch(() => setOllamaStatus("error"))
  }, [])

  return (
    <aside
      style={{ background: "var(--bg-base)", borderRight: "1px solid var(--border)" }}
      className="w-64 h-full flex flex-col flex-shrink-0"
    >
      {/* Logo */}
      <div className="px-5 pt-6 pb-5" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2.5 mb-1">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: "var(--accent-glow)", border: "1px solid var(--border-accent)", color: "var(--accent)" }}
          >
            EV
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
              EV AI Lab
            </h1>
            <p className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "'DM Mono', monospace" }}>
              UAE · Local LLM
            </p>
          </div>
        </div>
      </div>

      {/* Nav tabs */}
      <div className="px-3 pt-3 pb-2">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-1 text-left transition-all"
            style={
              activeTab === t.id
                ? { background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid var(--border-accent)" }
                : { color: "var(--text-muted)", border: "1px solid transparent" }
            }
          >
            <span className="text-base leading-none">{t.icon}</span>
            <span className="font-medium">{t.label}</span>
          </button>
        ))}
      </div>

      <div style={{ borderTop: "1px solid var(--border)" }} className="mt-1" />

      {/* Chat-specific controls */}
      {activeTab === "chat" && (
        <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-4">

          {/* Model selector */}
          <div>
            <p className="text-xs font-medium uppercase tracking-widest px-1 mb-2" style={{ color: "var(--text-muted)", fontFamily: "'DM Mono', monospace" }}>
              Model
            </p>
            <div className="flex flex-col gap-1">
              {MODELS.map(m => (
                <button
                  key={m.value}
                  onClick={() => setModel(m.value)}
                  className="flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all"
                  style={
                    model === m.value
                      ? { background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid var(--border-accent)" }
                      : { color: "var(--text-muted)", border: "1px solid transparent", background: "transparent" }
                  }
                >
                  <span className="font-semibold">{m.label}</span>
                  <span style={{ color: "var(--text-subtle)", fontFamily: "'DM Mono', monospace" }}>{m.tag}</span>
                </button>
              ))}
            </div>
            {ollamaStatus === "connected" && installedModels.length > 0 && (
              <p className="text-xs mt-2 px-1" style={{ color: "var(--text-subtle)", fontFamily: "'DM Mono', monospace" }}>
                installed: {installedModels.slice(0, 2).join(", ")}
              </p>
            )}
            {ollamaStatus === "error" && (
              <p className="text-xs mt-2 px-1" style={{ color: "#f87171" }}>
                Run <code style={{ fontFamily: "'DM Mono', monospace", background: "var(--bg-elevated)", padding: "1px 4px", borderRadius: 3 }}>ollama serve</code>
              </p>
            )}
          </div>

          {/* Prompt suggestions — clickable */}
          <div>
            <p className="text-xs font-medium uppercase tracking-widest px-1 mb-2" style={{ color: "var(--text-muted)", fontFamily: "'DM Mono', monospace" }}>
              Try asking
            </p>
            <div className="flex flex-col gap-1">
              {PROMPTS.map(p => (
                <button
                  key={p.text}
                  onClick={() => onPromptSelect?.(p.text)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-all group"
                  style={{ color: "var(--text-muted)", border: "1px solid transparent" }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "var(--bg-elevated)"
                    e.currentTarget.style.borderColor = "var(--border)"
                    e.currentTarget.style.color = "var(--text-primary)"
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "transparent"
                    e.currentTarget.style.borderColor = "transparent"
                    e.currentTarget.style.color = "var(--text-muted)"
                  }}
                >
                  <span className="flex-shrink-0">{p.icon}</span>
                  <span className="leading-relaxed">{p.text}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Dataset badge */}
          <div>
            <p className="text-xs font-medium uppercase tracking-widest px-1 mb-2" style={{ color: "var(--text-muted)", fontFamily: "'DM Mono', monospace" }}>
              Dataset
            </p>
            <div
              className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
            >
              <span style={{ color: "var(--text-primary)" }}>UAE EV Chargers</span>
              <span
                className="font-medium px-1.5 py-0.5 rounded text-xs"
                style={{ background: "var(--accent-glow)", color: "var(--accent)", fontFamily: "'DM Mono', monospace" }}
              >
                136
              </span>
            </div>
          </div>

          {/* Clear chat */}
          <button
            onClick={onClearChat}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all"
            style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#f87171"; e.currentTarget.style.color = "#f87171" }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)" }}
          >
            <span>↺</span>
            <span>Clear conversation</span>
          </button>
        </div>
      )}

      {/* Eval tab hint */}
      {activeTab === "eval" && (
        <div className="flex-1 px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-widest px-1 mb-3" style={{ color: "var(--text-muted)", fontFamily: "'DM Mono', monospace" }}>
            Run Evaluation
          </p>
          <div
            className="rounded-xl p-3 text-xs leading-relaxed"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", fontFamily: "'DM Mono', monospace", color: "var(--accent)" }}
          >
            <p style={{ color: "var(--text-subtle)" }}># all models</p>
            <p>python eval.py</p>
            <p className="mt-2" style={{ color: "var(--text-subtle)" }}># specific</p>
            <p>python eval.py \</p>
            <p className="pl-2">--models llama3</p>
          </div>
        </div>
      )}

      {/* Status footer */}
      <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${ollamaStatus === "connected" ? "dot-online" : ""}`}
            style={{
              background: ollamaStatus === "connected" ? "var(--accent)" : ollamaStatus === "error" ? "#ef4444" : "#f59e0b"
            }}
          />
          <span className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "'DM Mono', monospace" }}>
            {ollamaStatus === "connected" ? "ollama · online" : ollamaStatus === "error" ? "ollama · offline" : "ollama · checking"}
          </span>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
