import { useState, useRef, useEffect } from "react"
import Message from "./Message"
import PromptBox from "./PromptBox"
import { askLLMStream } from "../api/llmApi"

function Chat({ model, setHighlightedChargers }) {
  const [messages, setMessages]             = useState([])
  const [isStreaming, setIsStreaming]        = useState(false)
  const [locationFallback, setLocationFallback] = useState(false)
  const bottomRef = useRef(null)

  const sendPrompt = async (prompt) => {
    if (isStreaming) return

    // Fix #27: reset location fallback state on every new send
    setLocationFallback(false)

    // Snapshot history before this turn (role + content only, no UI metadata)
    const history = messages.map((m) => ({ role: m.role, content: m.content }))

    setMessages((prev) => [...prev, { role: "user", content: prompt }])
    setIsStreaming(true)

    // Add empty streaming placeholder for the assistant
    setMessages((prev) => [...prev, { role: "assistant", content: "", streaming: true }])

    const result = await askLLMStream(prompt, model, history, {
      onToken: (token) => {
        setMessages((prev) => {
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
      },

      onDone: () => {
        setMessages((prev) => {
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
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: "assistant",
            content:
              "Sorry, something went wrong. Please make sure Ollama is running with `ollama serve`.",
            streaming: false,
            error: true,
          }
          return updated
        })
        setIsStreaming(false)
      },
    })

    if (result?.locationFallback) {
      setLocationFallback(true)
    }
  }

  // Auto-scroll as tokens stream in
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="flex flex-col flex-1 h-full">
      {/* Header */}
      <div className="px-8 py-4 border-b bg-white flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg">EV Charging Assistant</h2>
          <p className="text-xs text-gray-500">Powered by {model}</p>
        </div>
        <div className="flex items-center gap-3">
          {locationFallback && (
            <div className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-3 py-1 rounded-full">
              📍 Using UAE center — location access denied
            </div>
          )}
          <div className="text-xs text-gray-400">UAE Charging Intelligence</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-slate-50 px-6 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center mt-20 text-gray-400">
              <h3 className="text-xl font-medium mb-3">
                Ask about EV charging in the UAE
              </h3>
              <p className="text-sm">Example questions:</p>
              <div className="mt-4 space-y-2 text-sm">
                <p>• Where can I find a fast charger near me?</p>
                <p>• Show me Tesla Superchargers in Dubai</p>
                <p>• Are there CCS2 chargers in Abu Dhabi?</p>
                <p>• What ADNOC chargers are nearby?</p>
                <p>• I have a non-Tesla EV, which CCS2 chargers can I use?</p>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <Message key={i} message={m} />
          ))}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <PromptBox onSend={sendPrompt} disabled={isStreaming} />
    </div>
  )
}

export default Chat
