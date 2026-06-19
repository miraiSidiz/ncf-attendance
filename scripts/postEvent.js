;(async ()=>{
  const resolveBase = async () => {
    const ports = [process.env.PORT, 3000, 3001, 3002, 3003].filter(Boolean)
    for (const p of ports) {
      try {
        const url = `http://localhost:${p}/api/events`
        const res = await fetch(url, { method: 'GET' })
        if (res.ok) return `http://localhost:${p}`
      } catch (e) { continue }
    }
    throw new Error('Could not find dev server on common ports')
  }
  try {
    const base = await resolveBase()
    const now = new Date();
    const start = new Date(now.getTime() + 30*60000).toISOString();
    const end = new Date(now.getTime() + 3*60*60000).toISOString();
    const ms = new Date(now.getTime() + 30*60000).toISOString();
    const me = new Date(now.getTime() + 90*60000).toISOString();
    const as = new Date(now.getTime() + 120*60000).toISOString();
    const ae = new Date(now.getTime() + 150*60000).toISOString();

    const body = {
      title: 'session-test-node',
      description: 'session test via node',
      startDate: start,
      endDate: end,
      morningStart: ms,
      morningEnd: me,
      afternoonStart: as,
      afternoonEnd: ae,
      useSessions: true
    }

    console.log('Sending body:', JSON.stringify(body, null, 2))
    const res = await fetch(base + '/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const text = await res.text()
    console.log('Status:', res.status)
    try { console.log('Body:', JSON.parse(text)) } catch(e) { console.log('Body (raw):', text) }
  } catch (err) {
    console.error('Request error:', err)
  }
})();
