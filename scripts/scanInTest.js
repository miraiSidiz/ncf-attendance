(async ()=>{
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
    console.log('Using base', base)
    console.log('Fetching scan-eligible events...')
    const eventsRes = await fetch(base + '/api/events?scope=scan')
    const events = await eventsRes.json()
    if (!events || events.length === 0) return console.error('No scan-eligible events found')
    const event = events[0]

    console.log('Fetching students...')
    const studentsRes = await fetch('http://localhost:3000/api/students')
    const students = await studentsRes.json()
    if (!students || students.length === 0) return console.error('No students found')
    const student = students[0]

    console.log('Using event:', event.id, 'student:', student.qrCode)

    const body = { qrCode: student.qrCode, eventId: event.id, action: 'in' }
    const res = await fetch(`${base}/api/attendance`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    })
    const json = await res.json()
    console.log('Status:', res.status)
    console.log('Response:', json)
    if (json.attendance) {
      console.log('timeOut is', json.attendance.timeOut)
    }
  } catch (err) { console.error(err) }
})();
