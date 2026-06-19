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
    // create a short event that supports sessions
    const now = new Date()
    const start = new Date(now.getTime() + 1000 * 10).toISOString() // start in 10s
    const end = new Date(now.getTime() + 1000 * 60 * 60).toISOString() // 1h
    const ms = new Date(now.getTime() + 1000 * 10).toISOString()
    const me = new Date(now.getTime() + 1000 * 60 * 20).toISOString() // 20m
    const as = new Date(now.getTime() + 1000 * 60 * 30).toISOString()
    const ae = new Date(now.getTime() + 1000 * 60 * 50).toISOString()

    console.log('Creating test event...')
    const evRes = await fetch(base + '/api/events', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'flow-test', description: 'auto test', startDate: start, endDate: end, morningStart: ms, morningEnd: me, afternoonStart: as, afternoonEnd: ae, useSessions: true })
    })
    const ev = await evRes.json()
    if (!ev.id) return console.error('Event creation failed', ev)
    console.log('Event created:', ev.id)

    // pick a student
    const studentsRes = await fetch(base + '/api/students')
    const students = await studentsRes.json()
    const student = students[0]
    if (!student) return console.error('No students')

    console.log('Waiting 12s until event start to allow time-in...')
    await new Promise(r=>setTimeout(r,12000))

    console.log('Time-in scan...')
    let res = await fetch('http://localhost:3000/api/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qrCode: student.qrCode, eventId: ev.id, action: 'in' }) })
    let body = await res.text(); try { body = JSON.parse(body) } catch(e) { console.log('Time-in returned non-json', body); throw e }
    console.log('Time-in status', res.status, body)

    console.log('Attempt time-out (should either set or be blocked until session end)')
    res = await fetch('http://localhost:3000/api/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qrCode: student.qrCode, eventId: ev.id, action: 'out' }) })
    body = await res.text(); try { body = JSON.parse(body) } catch(e) { console.log('Time-out returned non-json', body); throw e }
    console.log('Time-out status', res.status, body)

  } catch (err) { console.error(err) }
})();
