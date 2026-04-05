import { useState, useRef, useEffect, useCallback } from "react"
import Message from "./Message"
import PromptBox from "./PromptBox"
import { askLLMStream } from "../api/llmApi"

// Fix bug 4: generate stable unique IDs instead of using array index as key
let _msgId = 0
const nextId = () => `msg_${++_msgId}`

function Chat({ model, setHighlightedChargers, prefill, onPrefillConsumed, onClearChat }) {
  const [messages, setMessages]               = useState([])
  const [isStreaming, setIsStreaming]          = useState(false)
  const [locationFallback, setLocationFallback] = useState(false)
  const bottomRef = useRef(null)

  // Expose clear to parent via callback
  const handleClear = useCallback(() => {
    setMessages([])
    setHighlightedChargers([])
    setIsStreaming(false)
  }, [setHighlightedChargers])

  useEffect(() => {
    onClearChat?.(handleClear)
  }, [handleClear, onClearChat])

  const sendPrompt = async (prompt) => {
    if (isStreaming) return
    setLocationFallback(false)

    const history = messages.map(m => ({ role: m.role, content: m.content }))

    const userMsg = { id: nextId(), role: "user", content: prompt }
    const assistantMsg = { id: nextId(), role: "assistant", content: "", streaming: true, chargers: [] }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setIsStreaming(true)

    const result = await askLLMStream(prompt, model, history, {
      onToken: (token) => {
        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === "assistant") {
            updated[updated.length - 1] = { ...last, content: last.content + token }
          }
          return updated
        })
      },

      onChargers: (chargers) => {
        setHighlightedChargers(chargers)
        // Attach charger cards to the assistant message
        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === "assistant") {
            updated[updated.length - 1] = { ...last, chargers }
          }
          return updated
        })
      },

      onDone: () => {
        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === "assistant") {
            updated[updated.length - 1] = { ...last, streaming: false }
          }
          return updated
        })
        setIsStreaming(false)
      },

      onError: (err) => {
        console.error("Stream error:", err)
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: "Something went wrong. Make sure Ollama is running with `ollama serve`.",
            streaming: false,
            error: true,
          }
          return updated
        })
        setIsStreaming(false)
      },
    })

    if (result?.locationFallback) setLocationFallback(true)
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg-base)" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface)" }}
      >
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            EV Charging Assistant
          </h2>
          <p className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "'DM Mono', monospace" }}>
            {model} · UAE infrastructure
          </p>
        </div>
        <div className="flex items-center gap-2">
          {locationFallback && (
            <span
              className="text-xs px-2 py-1 rounded-lg"
              style={{ background: "rgba(245,158,11,0.12)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)" }}
            >
              📍 UAE center
            </span>
          )}
          {!isEmpty && (
            <span className="text-xs" style={{ color: "var(--text-subtle)", fontFamily: "'DM Mono', monospace" }}>
              {messages.filter(m => m.role === "user").length} turn{messages.filter(m => m.role === "user").length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full text-center" style={{ color: "var(--text-muted)" }}>
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mb-5"
              style={{ background: "var(--accent-glow)", border: "1px solid var(--border-accent)" }}
            >
              ⚡
            </div>
            <h3 className="text-lg font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              UAE EV Charging Intelligence
            </h3>
            <p className="text-sm mb-6 max-w-xs leading-relaxed">
              Ask about charging stations, fast chargers, connector types, or operators across the UAE.
            </p>
            <div className="grid grid-cols-2 gap-2 max-w-sm w-full">
              {[
                "Fast charger near me",
                "Tesla Supercharger Dubai",
                "CCS2 in Abu Dhabi",
                "ADNOC chargers",
              ].map(q => (
                <button
                  key={q}
                  onClick={() => sendPrompt(q)}
                  className="text-xs px-3 py-2.5 rounded-xl text-left transition-all"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    color: "var(--text-muted)",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-accent)"; e.currentTarget.style.color = "var(--accent)" }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)" }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map(m => (
            <Message key={m.id} message={m} />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <PromptBox
        onSend={sendPrompt}
        disabled={isStreaming}
        prefill={prefill}
        onPrefillConsumed={onPrefillConsumed}
      />
    </div>
  )
}

export default Chat
