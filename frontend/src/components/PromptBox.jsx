import { useState, useRef } from "react"

function PromptBox({ onSend, disabled, prefill, onPrefillConsumed }) {
  const [prompt, setPrompt] = useState("")
  const textareaRef = useRef(null)

  // Handle clickable sidebar suggestions (fix bug 7)
  if (prefill && prefill !== prompt) {
    setPrompt(prefill)
    onPrefillConsumed?.()
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const handleSend = () => {
    if (!prompt.trim() || disabled) return
    onSend(prompt.trim())
    setPrompt("")
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChange = (e) => {
    setPrompt(e.target.value)
    const ta = textareaRef.current
    if (!ta) return  // Fix bug 5: null guard
    ta.style.height = "auto"
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px"
  }

  return (
    <div
      className="px-4 py-3 flex-shrink-0"
      style={{ borderTop: "1px solid var(--border)", background: "var(--bg-base)" }}
    >
      <div
        className="flex items-end gap-2 rounded-xl px-3 py-2 transition-all"
        style={{
          background: "var(--bg-elevated)",
          border: `1px solid ${disabled ? "var(--border)" : prompt ? "var(--border-accent)" : "var(--border)"}`,
          opacity: disabled ? 0.7 : 1,
        }}
      >
        <textarea
          ref={textareaRef}
          className="flex-1 bg-transparent outline-none resize-none text-sm leading-relaxed py-1"
          style={{
            color: "var(--text-primary)",
            fontFamily: "'Sora', sans-serif",
            maxHeight: "160px",
            minHeight: "24px",
          }}
          rows={1}
          placeholder={disabled ? "Waiting for response…" : "Ask about EV charging in the UAE…"}
          value={prompt}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />

        <button
          onClick={handleSend}
          disabled={disabled || !prompt.trim()}
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all"
          style={{
            background: disabled || !prompt.trim() ? "var(--bg-surface)" : "var(--accent)",
            color: disabled || !prompt.trim() ? "var(--text-subtle)" : "#0a0f1e",
            cursor: disabled || !prompt.trim() ? "not-allowed" : "pointer",
            fontSize: "14px",
          }}
        >
          ↑
        </button>
      </div>

      <div className="flex justify-between mt-1.5 px-1">
        <span className="text-xs" style={{ color: "var(--text-subtle)", fontFamily: "'DM Mono', monospace" }}>
          ↵ send · ⇧↵ newline
        </span>
        {disabled && (
          <span
            className="text-xs"
            style={{ color: "var(--accent)", fontFamily: "'DM Mono', monospace" }}
          >
            generating…
          </span>
        )}
      </div>
    </div>
  )
}

export default PromptBox
