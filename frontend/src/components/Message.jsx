function Message({ message }) {

  const isUser = message.role === "user"

  return (
    <div className={`flex items-start gap-3 ${isUser ? "justify-end" : "justify-start"}`}>

      {/* Assistant Avatar */}
      {!isUser && (
        <div className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-sm">
          ⚡
        </div>
      )}

      {/* Message Bubble */}
      <div
        className={`
          max-w-2xl
          px-4
          py-3
          rounded-2xl
          text-sm
          leading-relaxed
          shadow-sm
          whitespace-pre-wrap
          ${isUser
            ? "bg-blue-600 text-white rounded-br-md"
            : "bg-white border border-gray-200 text-gray-800 rounded-bl-md"}
        `}
      >
        {message.content}
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white text-sm">
          U
        </div>
      )}

    </div>
  )
}

export default Message