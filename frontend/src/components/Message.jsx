function Message({ message }) {
  const isUser = message.role === "user"

  return (
    <div className={`flex items-start gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {/* Assistant avatar */}
      {!isUser && (
        <div className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-sm flex-shrink-0">
          ⚡
        </div>
      )}

      {/* Bubble */}
      <div
        className={`
          max-w-2xl px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm whitespace-pre-wrap
          ${isUser
            ? "bg-blue-600 text-white rounded-br-md"
            : message.error
              ? "bg-red-50 border border-red-200 text-red-700 rounded-bl-md"
              : "bg-white border border-gray-200 text-gray-800 rounded-bl-md"
          }
        `}
      >
        {message.content || (message.streaming ? "" : "…")}

        {/* Streaming cursor dots */}
        {message.streaming && (
          <span className="inline-flex gap-0.5 ml-1 align-middle">
            <span
              className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </span>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white text-sm flex-shrink-0">
          U
        </div>
      )}
    </div>
  )
}

export default Message
