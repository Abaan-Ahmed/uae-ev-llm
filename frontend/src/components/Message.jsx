// Fix bug 4: messages use stable IDs not array index as key (done in Chat.jsx)

const TYPE_COLORS = {
  "DC Fast":     { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.3)",  text: "#fca5a5" },
  "AC Fast":     { bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.3)", text: "#93c5fd" },
  "AC Standard": { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", text: "#6ee7b7" },
}
const DEFAULT_TYPE = { bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)", text: "#94a3b8" }

function ChargerCard({ charger }) {
  const tc = TYPE_COLORS[charger.charger_type] || DEFAULT_TYPE
  return (
    <div
      className="rounded-xl p-3 mb-2 last:mb-0"
      style={{ background: "var(--bg-base)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-sm font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
          {charger.name}
        </span>
        {charger.distance != null && (
          <span
            className="text-xs flex-shrink-0 font-medium px-1.5 py-0.5 rounded"
            style={{ background: "var(--accent-glow)", color: "var(--accent)", fontFamily: "'DM Mono', monospace" }}
          >
            {charger.distance} km
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {charger.charger_type && (
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: tc.bg, border: `1px solid ${tc.border}`, color: tc.text, fontFamily: "'DM Mono', monospace" }}
          >
            {charger.charger_type}{charger.power_kw ? ` · ${charger.power_kw} kW` : ""}
          </span>
        )}
        {charger.connectors?.slice(0, 2).map(c => (
          <span
            key={c}
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", fontFamily: "'DM Mono', monospace", border: "1px solid var(--border)" }}
          >
            {c}
          </span>
        ))}
        {charger.operator && charger.operator !== "Unknown" && (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{charger.operator}</span>
        )}
      </div>
    </div>
  )
}

function Message({ message }) {
  const isUser = message.role === "user"

  if (isUser) {
    return (
      <div className="msg-animate flex justify-end">
        <div
          className="max-w-lg px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed"
          style={{ background: "var(--accent)", color: "#0a0f1e", fontWeight: 500 }}
        >
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="msg-animate flex items-start gap-3">
      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
        style={{ background: "var(--accent-glow)", border: "1px solid var(--border-accent)", color: "var(--accent)" }}
      >
        AI
      </div>

      <div className="flex-1 min-w-0">
        {/* Text bubble */}
        <div
          className={`px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed ${message.error ? "" : ""}`}
          style={
            message.error
              ? { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }
              : { background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }
          }
        >
          <span
            className={message.streaming && !message.content ? "streaming-cursor" : ""}
            style={{ whiteSpace: "pre-wrap" }}
          >
            {message.content}
          </span>
          {message.streaming && message.content && (
            <span className="streaming-cursor" />
          )}
        </div>

        {/* Charger cards attached below the bubble */}
        {message.chargers?.length > 0 && (
          <div
            className="mt-2 rounded-2xl rounded-tl-sm p-3"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
          >
            <p
              className="text-xs font-medium uppercase tracking-widest mb-2 px-1"
              style={{ color: "var(--text-muted)", fontFamily: "'DM Mono', monospace" }}
            >
              {message.chargers.length} charger{message.chargers.length !== 1 ? "s" : ""} matched
            </p>
            {message.chargers.map((c, i) => (
              <ChargerCard key={i} charger={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Message
