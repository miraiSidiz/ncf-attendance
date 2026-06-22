(async ()=>{
  const base = process.env.BASE || 'http://localhost:3001'
  const eventId = process.env.EVENT_ID || 'cmqne3lv90000w76ml32cnqth'
  try {
    console.log('Fetching /api/dashboard from', base)
    const dsRes = await fetch(`${base}/api/dashboard`)
    const ds = await dsRes.json()
    console.log('DASHBOARD SUMMARY:')
    console.log(JSON.stringify(ds, null, 2))

    console.log('\nFetching attendances for event', eventId)
    const atRes = await fetch(`${base}/api/attendance?eventId=${eventId}`)
    const at = await atRes.json()
    console.log('ATTENDANCES:')
    console.log(JSON.stringify(at, null, 2))
  } catch (e) {
    console.error('error', e)
  }
})()
