import { useState, useRef, useCallback } from "react"
import Sidebar from "./components/Sidebar"
import Chat from "./components/Chat"
import EVMap from "./components/EVMap"
import EvalDashboard from "./components/EvalDashboard"

function App() {
  const [model, setModel]                             = useState("llama3")
  const [highlightedChargers, setHighlightedChargers] = useState([])
  const [activeTab, setActiveTab]                     = useState("chat")
  const [prefill, setPrefill]                         = useState("")
  const clearChatRef = useRef(null)

  // Sidebar suggestion clicked → fill chat input
  const handlePromptSelect = (text) => {
    setActiveTab("chat")
    setPrefill(text)
  }

  // Clear chat callback registration from Chat component
  const handleClearChatRegister = useCallback((fn) => {
    clearChatRef.current = fn
  }, [])

  const handleClearChat = () => {
    clearChatRef.current?.()
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden" style={{ background: "var(--bg-base)" }}>
      <Sidebar
        model={model}
        setModel={setModel}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onPromptSelect={handlePromptSelect}
        onClearChat={handleClearChat}
      />

      <div className="flex flex-1 overflow-hidden">
        {activeTab === "chat" && (
          <>
            <div className="flex flex-col flex-[1.3] overflow-hidden" style={{ borderRight: "1px solid var(--border)" }}>
              <Chat
                model={model}
                setHighlightedChargers={setHighlightedChargers}
                prefill={prefill}
                onPrefillConsumed={() => setPrefill("")}
                onClearChat={handleClearChatRegister}
              />
            </div>
            <div className="flex-[1] overflow-hidden">
              <EVMap highlightedChargers={highlightedChargers} />
            </div>
          </>
        )}

        {activeTab === "eval" && (
          <div className="flex-1 overflow-hidden">
            <EvalDashboard />
          </div>
        )}
      </div>
    </div>
  )
}

export default App
