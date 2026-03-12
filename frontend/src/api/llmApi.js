export const askLLM = async (prompt, model) => {

  return new Promise((resolve, reject) => {

    navigator.geolocation.getCurrentPosition(async (position) => {

      const lat = position.coords.latitude
      const lng = position.coords.longitude

      const response = await fetch("http://localhost:8000/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: prompt,
          model: model,
          lat: lat,
          lng: lng
        })
      })

      const data = await response.json()

      resolve(data)

    }, (error) => {

      console.error("Location error:", error)

      reject(error)

    })

  })

}