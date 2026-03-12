import { useState, useRef } from "react"

function PromptBox({ onSend }) {

  const [prompt, setPrompt] = useState("")
  const textareaRef = useRef(null)

  const handleSend = () => {

    if (!prompt.trim()) return

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

    const textarea = textareaRef.current
    textarea.style.height = "auto"
    textarea.style.height = textarea.scrollHeight + "px"

  }

  return (

    <div className="border-t bg-white px-6 py-4">

      <div className="max-w-3xl mx-auto flex items-end gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 shadow-sm">

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          className="flex-1 bg-transparent outline-none resize-none text-sm leading-relaxed max-h-40"
          rows="1"
          placeholder="Ask about EV charging in the UAE..."
          value={prompt}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />

        {/* Send Button */}
        <button
          onClick={handleSend}
          className="
            flex items-center justify-center
            w-10 h-10
            rounded-lg
            bg-blue-600
            text-white
            hover:bg-blue-700
            transition
          "
        >
          ➤
        </button>

      </div>

      {/* Hint */}
      <div className="max-w-3xl mx-auto mt-2 text-xs text-gray-400 flex justify-between">

        <span>Enter to send</span>

        <span>Shift + Enter for new line</span>

      </div>

    </div>

  )
}

export default PromptBox