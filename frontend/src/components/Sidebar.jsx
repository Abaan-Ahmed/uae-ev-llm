function Sidebar({ model, setModel }) {

  return (
    <div className="w-72 h-full bg-gradient-to-b from-slate-900 to-slate-800 text-white flex flex-col shadow-xl">

      {/* Header */}
      <div className="px-6 py-6 border-b border-slate-700">
        <h1 className="text-2xl font-semibold tracking-tight">
          ⚡ EV AI Lab
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          UAE Charging Intelligence
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-6 px-6 py-6">

        {/* Model Selector */}
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">
            Model
          </p>

          <select
            value={model}
            onChange={(e)=>setModel(e.target.value)}
            className="
              w-full
              bg-slate-700
              border border-slate-600
              rounded-lg
              px-3 py-2
              text-sm
              focus:outline-none
              focus:ring-2
              focus:ring-blue-500
              transition
            "
          >
            <option value="llama3">Llama3</option>
            <option value="mistral">Mistral</option>
            <option value="phi">Phi</option>
            <option value="gemma">Gemma</option>
          </select>
        </div>

        {/* Dataset */}
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">
            Dataset
          </p>

          <div className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm flex items-center justify-between">
            <span>UAE EV Chargers</span>
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
              Active
            </span>
          </div>
        </div>

      </div>

      {/* Spacer */}
      <div className="flex-grow"></div>

      {/* System Status */}
      <div className="px-6 py-4 border-t border-slate-700">

        <div className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
          Ollama Connected
        </div>

        <p className="text-xs text-slate-500 mt-2">
          Local LLM Runtime
        </p>

      </div>

    </div>
  )
}

export default Sidebar