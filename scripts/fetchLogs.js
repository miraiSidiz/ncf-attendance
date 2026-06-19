(async ()=>{
  const ports = [process.env.PORT, 3000, 3001, 3002, 3003].filter(Boolean)
  let lastErr = null
  for (const p of ports) {
    const url = `http://localhost:${p}/api/admin/attendance-logs`
    try {
      const res = await fetch(url)
      // ensure we got JSON
      const text = await res.text()
      try {
        const data = JSON.parse(text)
        console.log('fetched from', url)
        console.log('logs:', (data.logs||[]).length)
        console.log((data.logs||[]).slice(0,5))
        return
      } catch (e) {
        // maybe HTML was returned; continue to next port
        lastErr = new Error(`Non-JSON response from ${url}: ${text.slice(0,200)}`)
      }
    } catch (e) {
      lastErr = e
    }
  }
  console.error('All ports failed:', lastErr)
})();
