export const askLLM = async (prompt, model, onToken) => {

  const response = await fetch("http://localhost:8000/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      prompt,
      model
    })
  })

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {

    const { done, value } = await reader.read()

    if (done) break

    const chunk = decoder.decode(value)

    onToken(chunk)
  }
}