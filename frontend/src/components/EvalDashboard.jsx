import { useState, useEffect } from "react"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"

const MODEL_COLORS = {
  llama3:  { bg: "bg-violet-100",  text: "text-violet-800",  bar: "#7c3aed" },
  mistral: { bg: "bg-blue-100",    text: "text-blue-800",    bar: "#2563eb" },
  gemma:   { bg: "bg-emerald-100", text: "text-emerald-800", bar: "#059669" },
  phi:     { bg: "bg-orange-100",  text: "text-orange-800",  bar: "#ea580c" },
}
const DEFAULT_COLOR = { bg: "bg-gray-100", text: "text-gray-800", bar: "#6b7280" }

function ScoreBar({ value, color }) {
  const pct = Math.round((value ?? 0) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-mono w-8 text-right">{pct}%</span>
    </div>
  )
}

function ModelCard({ model, stats }) {
  const c = MODEL_COLORS[model] ?? DEFAULT_COLOR
  const scores = [
    { label: "Accuracy",   value: stats.avg_accuracy   },
    { label: "Reasoning",  value: stats.avg_reasoning  },
    { label: "Tool Usage", value: stats.avg_tool_usage },
  ]
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${c.bg} ${c.text}`}>
          {model}
        </span>
        <div className="text-right">
          <p className="text-xs text-gray-400">Avg Latency</p>
          <p className="text-lg font-semibold text-gray-800">{stats.avg_latency_s?.toFixed(1)}s</p>
        </div>
      </div>

      <div className="space-y-2">
        {scores.map(({ label, value }) => (
          <div key={label}>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{label}</span>
            </div>
            <ScoreBar value={value} color={c.bar} />
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-1 border-t border-gray-100 text-xs text-gray-500">
        <span>
          <span className="font-medium text-gray-700">{stats.total_queries}</span> queries
        </span>
        {stats.errors > 0 && (
          <span className="text-red-500">
            <span className="font-medium">{stats.errors}</span> errors
          </span>
        )}
        {stats.hallucinations > 0 && (
          <span className="text-amber-600">
            <span className="font-medium">{stats.hallucinations}</span> hallucinations
          </span>
        )}
      </div>
    </div>
  )
}

function ResultsTable({ results, selectedModel }) {
  const filtered = selectedModel === "all"
    ? results
    : results.filter(r => r.model === selectedModel)

  const scoreColor = (v) => {
    if (v >= 0.8) return "text-emerald-600 font-medium"
    if (v >= 0.5) return "text-amber-600"
    return "text-red-500"
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {["ID", "Model", "Query", "Location", "Accuracy", "Reasoning", "Tool", "Latency", "Issues"].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {filtered.map((r, i) => (
            <tr key={i} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.query_id}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${(MODEL_COLORS[r.model] ?? DEFAULT_COLOR).bg} ${(MODEL_COLORS[r.model] ?? DEFAULT_COLOR).text}`}>
                  {r.model}
                </span>
              </td>
              <td className="px-4 py-3 max-w-xs">
                <span className="truncate block text-gray-700" title={r.query}>{r.query}</span>
              </td>
              <td className="px-4 py-3 text-gray-500 text-xs">{r.location}</td>
              <td className={`px-4 py-3 ${scoreColor(r.accuracy)}`}>
                {r.error ? "—" : (r.accuracy * 100).toFixed(0) + "%"}
              </td>
              <td className={`px-4 py-3 ${scoreColor(r.reasoning)}`}>
                {r.error ? "—" : (r.reasoning * 100).toFixed(0) + "%"}
              </td>
              <td className={`px-4 py-3 ${scoreColor(r.tool_usage)}`}>
                {r.error ? "—" : (r.tool_usage * 100).toFixed(0) + "%"}
              </td>
              <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                {r.error ? "—" : r.latency_s?.toFixed(1) + "s"}
              </td>
              <td className="px-4 py-3">
                {r.error
                  ? <span className="text-red-500 text-xs">⛔ {r.error}</span>
                  : r.hallucinations?.length > 0
                    ? <span className="text-amber-500 text-xs">⚠ halluc</span>
                    : <span className="text-emerald-500 text-xs">✓</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EmptyState({ onRefetch }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-5xl mb-4">📊</div>
      <h3 className="text-xl font-semibold text-gray-700 mb-2">No evaluation results yet</h3>
      <p className="text-sm text-gray-400 max-w-sm mb-6">
        Run the evaluation harness from the backend to generate results.
      </p>
      <div className="bg-gray-900 text-green-400 rounded-xl px-6 py-4 font-mono text-sm text-left mb-6">
        <p className="text-gray-500 mb-1"># In your backend directory:</p>
        <p>cd backend</p>
        <p>python eval.py</p>
      </div>
      <button
        onClick={onRefetch}
        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
      >
        Check again
      </button>
    </div>
  )
}

export default function EvalDashboard() {
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [selectedModel, setSelectedModel] = useState("all")
  const [tab, setTab]             = useState("summary") // "summary" | "results"

  const fetchResults = () => {
    setLoading(true)
    setError(null)
    fetch(`${API_URL}/eval-results`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setData(null) }
        else { setData(d) }
        setLoading(false)
      })
      .catch(() => {
        setError("Could not reach backend")
        setLoading(false)
      })
  }

  useEffect(() => { fetchResults() }, [])

  const models = data ? Object.keys(data.summary) : []

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Model Evaluation</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {data
              ? `Last run: ${new Date(data.run_at).toLocaleString()} · ${data.results?.length ?? 0} total runs`
              : "Run eval.py to generate results"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Tab switcher */}
          <div className="flex bg-gray-100 rounded-lg p-1 text-sm">
            {["summary", "results"].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-md capitalize transition ${
                  tab === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <button
            onClick={fetchResults}
            className="text-xs px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 px-8 py-6">
        {loading && (
          <div className="flex items-center justify-center py-24 text-gray-400">
            Loading results…
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-6 py-4 text-sm">
            ⛔ {error} — make sure the backend is running.
          </div>
        )}

        {!loading && !error && !data && <EmptyState onRefetch={fetchResults} />}

        {!loading && data && tab === "summary" && (
          <div className="space-y-6">
            {/* Dimension legend */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Evaluation Dimensions</h3>
              <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="font-semibold text-gray-800 mb-1">📍 Accuracy</p>
                  <p>Did the backend return the correct charger, city, and type for the query?</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="font-semibold text-gray-800 mb-1">🧠 Reasoning</p>
                  <p>Does the LLM explain distance, charger type, connectors, and make a recommendation?</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="font-semibold text-gray-800 mb-1">🔧 Tool Usage</p>
                  <p>Does the LLM cite real charger names from the backend, or hallucinate?</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="font-semibold text-gray-800 mb-1">⚡ Latency</p>
                  <p>End-to-end response time in seconds, including LLM inference.</p>
                </div>
              </div>
            </div>

            {/* Model cards */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Model Comparison
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {models.map(m => (
                  <ModelCard key={m} model={m} stats={data.summary[m]} />
                ))}
              </div>
            </div>

            {/* Comparison table */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Side-by-side Summary
              </h3>
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {["Model", "Accuracy", "Reasoning", "Tool Usage", "Avg Latency", "Errors", "Hallucinations"].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {models.map(m => {
                      const s = data.summary[m]
                      const c = MODEL_COLORS[m] ?? DEFAULT_COLOR
                      const fmt = v => (v * 100).toFixed(1) + "%"
                      return (
                        <tr key={m} className="hover:bg-slate-50">
                          <td className="px-5 py-3">
                            <span className={`px-2 py-0.5 rounded font-medium text-xs ${c.bg} ${c.text}`}>{m}</span>
                          </td>
                          <td className="px-5 py-3 font-mono text-sm">{fmt(s.avg_accuracy)}</td>
                          <td className="px-5 py-3 font-mono text-sm">{fmt(s.avg_reasoning)}</td>
                          <td className="px-5 py-3 font-mono text-sm">{fmt(s.avg_tool_usage)}</td>
                          <td className="px-5 py-3 font-mono text-sm">{s.avg_latency_s?.toFixed(1)}s</td>
                          <td className={`px-5 py-3 text-sm ${s.errors > 0 ? "text-red-500 font-medium" : "text-gray-400"}`}>
                            {s.errors}
                          </td>
                          <td className={`px-5 py-3 text-sm ${s.hallucinations > 0 ? "text-amber-600 font-medium" : "text-gray-400"}`}>
                            {s.hallucinations}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {!loading && data && tab === "results" && (
          <div className="space-y-4">
            {/* Model filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Filter:</span>
              {["all", ...models].map(m => {
                const c = MODEL_COLORS[m] ?? DEFAULT_COLOR
                const active = selectedModel === m
                return (
                  <button
                    key={m}
                    onClick={() => setSelectedModel(m)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                      active
                        ? `${c.bg} ${c.text} border-transparent`
                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {m}
                  </button>
                )
              })}
            </div>

            <ResultsTable results={data.results} selectedModel={selectedModel} />
          </div>
        )}
      </div>
    </div>
  )
}
