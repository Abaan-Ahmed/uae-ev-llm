import { useState, useRef, useEffect } from "react"
import Message from "./Message"
import PromptBox from "./PromptBox"
import { askLLM } from "../api/llmApi"

function Chat({ model }) {

  const [messages, setMessages] = useState([])
  const [isThinking, setIsThinking] = useState(false)

  const bottomRef = useRef(null)

  const sendPrompt = async (prompt) => {

    const userMsg = { role: "user", content: prompt }
    const assistantMsg = { role: "assistant", content: "" }

    setMessages(prev => [...prev, userMsg])

    setIsThinking(true)

    await askLLM(prompt, model, (token) => {

      setIsThinking(false)

      assistantMsg.content += token

      setMessages(prev => {

        let updated = [...prev]

        if (updated[updated.length - 1]?.role !== "assistant") {
          updated.push({ ...assistantMsg })
        } else {
          updated[updated.length - 1] = { ...assistantMsg }
        }

        return updated
      })

    })
  }

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isThinking])

  return (
    <div className="flex flex-col flex-1 h-full">

      {/* Header */}
      <div className="px-8 py-4 border-b bg-white flex items-center justify-between">

        <div>
          <h2 className="font-semibold text-lg">
            EV Charging Assistant
          </h2>

          <p className="text-xs text-gray-500">
            Powered by {model}
          </p>
        </div>

        <div className="text-xs text-gray-400">
          UAE Charging Intelligence
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

                <p>• Where can I charge near Dubai Marina?</p>
                <p>• Are there fast chargers in Abu Dhabi?</p>
                <p>• How many EV chargers are in the UAE?</p>

              </div>

            </div>
          )}

          {messages.map((m, i) => (
            <Message key={i} message={m} />
          ))}

          {/* AI typing indicator */}
          {isThinking && (
            <div className="flex items-center gap-3">

              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200">
                ⚡
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm flex gap-1">

                <span className="animate-bounce">.</span>
                <span className="animate-bounce delay-100">.</span>
                <span className="animate-bounce delay-200">.</span>

              </div>

            </div>
          )}

          <div ref={bottomRef}></div>

        </div>

      </div>

      {/* Input */}
      <PromptBox onSend={sendPrompt} />

    </div>
  )
}

export default Chat