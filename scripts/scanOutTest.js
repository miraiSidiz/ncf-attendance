;(async ()=>{
  const resolveBase = async () => {
    const ports = [process.env.PORT, 3000, 3001, 3002, 3003].filter(Boolean)
    for (const p of ports) {
      try {
        const url = `http://localhost:${p}/api/events?scope=scan`
        const res = await fetch(url)
        const text = await res.text()
        try { JSON.parse(text); return `http://localhost:${p}` } catch(e) { continue }
      } catch (e) { continue }
    }
    throw new Error('Could not find dev server on common ports')
  }
  try {
    const base = await resolveBase()
    const eventsRes = await fetch(base + '/api/events?scope=scan')
    const events = await eventsRes.json()
    if (!events || events.length === 0) return console.error('No scan-eligible events found')
    const event = events[0]

    const studentsRes = await fetch(base + '/api/students')
    const students = await studentsRes.json()
    if (!students || students.length === 0) return console.error('No students found')
    const student = students[0]

    console.log('Using event:', event.id, 'student:', student.qrCode)

    // First, time-in
    let res = await fetch(base + '/api/attendance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qrCode: student.qrCode, eventId: event.id, action: 'in' })
    })
    let text = await res.text()
    let json
    try { json = JSON.parse(text) } catch(e) { console.error('Time-in response not JSON, raw:', text); throw e }
    console.log('Time-in status:', res.status)
    console.log('Time-in attendance timeOut:', json.attendance ? json.attendance.timeOut : 'no attendance')

    // Then attempt time-out
    res = await fetch(base + '/api/attendance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qrCode: student.qrCode, eventId: event.id, action: 'out' })
    })
    text = await res.text()
    try { json = JSON.parse(text) } catch(e) { console.error('Time-out response not JSON, raw:', text); throw e }
    console.log('Time-out status:', res.status)
    console.log('Time-out response:', json)
  } catch (err) { console.error(err) }
})();
