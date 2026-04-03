import { useState, useRef } from "react"

function PromptBox({ onSend, disabled }) {
  const [prompt, setPrompt] = useState("")
  const textareaRef = useRef(null)

  const handleSend = () => {
    if (!prompt.trim() || disabled) return
    onSend(prompt)
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
    ta.style.height = "auto"
    ta.style.height = ta.scrollHeight + "px"
  }

  return (
    <div className="border-t bg-white px-6 py-4">
      <div
        className={`
          max-w-3xl mx-auto flex items-end gap-3 bg-gray-50 border rounded-xl px-4 py-3 shadow-sm transition
          ${disabled ? "border-gray-100 opacity-70" : "border-gray-200"}
        `}
      >
        <textarea
          ref={textareaRef}
          className="flex-1 bg-transparent outline-none resize-none text-sm leading-relaxed max-h-40"
          rows="1"
          placeholder={
            disabled
              ? "Waiting for response…"
              : "Ask about EV charging in the UAE…"
          }
          value={prompt}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />

        <button
          onClick={handleSend}
          disabled={disabled}
          className={`
            flex items-center justify-center w-10 h-10 rounded-lg text-white transition
            ${disabled
              ? "bg-gray-300 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 active:scale-95"
            }
          `}
        >
          ➤
        </button>
      </div>

      <div className="max-w-3xl mx-auto mt-2 text-xs text-gray-400 flex justify-between">
        <span>Enter to send · Shift + Enter for new line</span>
        {disabled && (
          <span className="text-blue-400 animate-pulse">AI is responding…</span>
        )}
      </div>
    </div>
  )
}

export default PromptBox
