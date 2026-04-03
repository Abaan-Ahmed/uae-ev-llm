const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"

// UAE geographic center as fallback when geolocation is unavailable
const UAE_CENTER = { lat: 24.4539, lng: 54.3773 }

/**
 * Resolves the user's location. Always resolves (never rejects):
 * returns { lat, lng, fallback: true } if geolocation is denied/unavailable.
 */
export const getLocation = () =>
  new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ ...UAE_CENTER, fallback: true })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        fallback: false,
      }),
      () => resolve({ ...UAE_CENTER, fallback: true }),
      { timeout: 6000 }
    )
  })

/**
 * Stream a response from the LLM.
 *
 * Calls onChargers({ chargers }) as soon as the map data arrives,
 * then calls onToken(token) for each streamed text chunk,
 * then calls onDone() when the stream closes.
 * Calls onError(err) if the request fails.
 *
 * Returns { locationFallback: bool }.
 */
export const askLLMStream = async (
  prompt,
  model,
  history = [],
  { onToken, onChargers, onDone, onError } = {}
) => {
  const location = await getLocation()

  try {
    const response = await fetch(`${API_URL}/ask/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        model,
        lat: location.lat,
        lng: location.lng,
        history,
      }),
    })

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() // keep any incomplete line for next iteration

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue
        try {
          const event = JSON.parse(line.slice(6))
          if (event.type === "chargers") onChargers?.(event.chargers)
          else if (event.type === "token")  onToken?.(event.token)
          else if (event.type === "done")   onDone?.()
          else if (event.type === "error")  onError?.(new Error(event.message))
        } catch {
          // skip malformed SSE lines
        }
      }
    }
  } catch (err) {
    onError?.(err)
  }

  return { locationFallback: location.fallback }
}
