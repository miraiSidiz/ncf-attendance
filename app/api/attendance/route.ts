import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getToken } from 'next-auth/jwt'
import { publishAttendance } from '@/lib/sse'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get('eventId')

  try {
    let query: any = { include: { student: true, event: true } }

    if (eventId) {
      query.where = { eventId }
    }

    const attendances = await prisma.attendance.findMany(query)
    return NextResponse.json(attendances)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { qrCode, eventId, action, sessionType: requestedSessionType } = await request.json()
    console.log('POST /api/attendance received:', { qrCode, eventId, action, requestedSessionType, at: new Date().toISOString() })
    
    const [student, event] = await Promise.all([
      prisma.student.findFirst({ where: { qrCode } }),
      prisma.event.findUnique({ where: { id: eventId } })
    ])

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const now = new Date()
    // Shift all times to Philippine Standard Time (UTC+8) to prevent server/client timezone mismatches
    const phNow = new Date(now.getTime() + 8 * 60 * 60 * 1000)
    const phStartDate = new Date(new Date(event.startDate).getTime() + 8 * 60 * 60 * 1000)

    // Default session windows in PH time
    const phMorningEnd = event.morningEnd 
      ? new Date(new Date(event.morningEnd).getTime() + 8 * 60 * 60 * 1000) 
      : (() => { const d = new Date(phNow); d.setUTCHours(12,0,0,0); return d })()

    const phAfternoonStart = event.afternoonStart 
      ? new Date(new Date(event.afternoonStart).getTime() + 8 * 60 * 60 * 1000) 
      : (() => { const d = new Date(phNow); d.setUTCHours(13,0,0,0); return d })()

    const phAfternoonEnd = event.afternoonEnd 
      ? new Date(new Date(event.afternoonEnd).getTime() + 8 * 60 * 60 * 1000) 
      : (() => { const d = new Date(phNow); d.setUTCHours(17,0,0,0); return d })()

    // Align afternoon start time to the current date in PH time
    const afternoonStartToday = new Date(phNow)
    afternoonStartToday.setUTCHours(
      phAfternoonStart.getUTCHours(), 
      phAfternoonStart.getUTCMinutes(), 
      phAfternoonStart.getUTCSeconds(), 
      phAfternoonStart.getUTCMilliseconds()
    )

    // Determine session type from request or by comparing PH now with PH afternoon start
    let sessionType = requestedSessionType || (phNow >= afternoonStartToday ? 'afternoon' : 'morning')

    // Check for existing time-in for this session
    const existing = await prisma.attendance.findUnique({
      where: {
        studentId_eventId_sessionType: {
          studentId: student.id,
          eventId: eventId,
          sessionType: sessionType
        }
      }
    })

    // Late if scanned > 30 min after session starts
    let status = 'PRESENT'
    if (sessionType === 'morning') {
      const morningStartToday = new Date(phNow)
      morningStartToday.setUTCHours(
        phStartDate.getUTCHours(), 
        phStartDate.getUTCMinutes(), 
        phStartDate.getUTCSeconds(), 
        phStartDate.getUTCMilliseconds()
      )
      const thirtyMinAfterMorningStart = new Date(morningStartToday.getTime() + 30 * 60 * 1000)
      if (phNow > thirtyMinAfterMorningStart) status = 'LATE'
    } else if (sessionType === 'afternoon') {
      const thirtyMinAfterAfternoonStart = new Date(afternoonStartToday.getTime() + 30 * 60 * 1000)
      if (phNow > thirtyMinAfterAfternoonStart) status = 'LATE'
    }

    // Explicit time-in requested
    if (action === 'in') {
      console.log('Handling explicit time-in', { student: student.id, eventId, requestedSessionType, sessionType })

      // Ensure we only check/create the attendance for the resolved sessionType (no cross-session creates)
      // Reuse the existing query we ran at the start of the handler to save a database round-trip
      if (existing && existing.scannedAt) {
        return NextResponse.json({ error: `Student already timed in for ${sessionType} session` }, { status: 400 })
      }

      // Defensive check bypassed: Allow afternoon scans even if the student did not log out of the morning session
      // const openOther = await prisma.attendance.findFirst({ where: { studentId: student.id, eventId, timeOut: null } })
      // if (openOther && openOther.sessionType !== sessionType) {
      //   return NextResponse.json({ error: `Existing open attendance found for ${openOther.sessionType} session; close it before creating ${sessionType} in.` }, { status: 400 })
      // }

      // Auto-set time-out based on session (prefer event-specific end times)
      let autoTimeOut = null
      if (sessionType === 'morning') {
        autoTimeOut = event.morningEnd ? new Date(event.morningEnd) : phMorningEnd
      } else if (sessionType === 'afternoon') {
        autoTimeOut = event.afternoonEnd ? new Date(event.afternoonEnd) : phAfternoonEnd
      }

      let attendance: any = null
      try {
        attendance = await prisma.attendance.create({
          data: {
            studentId: student.id,
            eventId: eventId,
            sessionType,
            status,
            scannedAt: now
          }
        })
      } catch (e: any) {
        // Handle unique constraint race: if another request created it concurrently, return friendly error
        if (e && e.code === 'P2002') {
          return NextResponse.json({ error: `Student already timed in for ${sessionType} session` }, { status: 400 })
        }
        throw e
      }

      // create audit log for time-in
      try {
        await prisma.attendanceLog.create({
          data: {
            attendanceId: attendance.id,
            eventId: eventId,
            studentId: student.id,
            action: 'in',
            newTimeOut: attendance.timeOut || null
          }
        })
      } catch (e) { console.error('attendanceLog create failed (in):', e) }

      // publish realtime event
      try {
        publishAttendance('in', { attendance: attendance, student, event, sessionType, status })
      } catch (e) { }

      return NextResponse.json({ attendance, student, event })
    }

    // Explicit time-out requested
    if (action === 'out') {
      // If there is no existing attendance for the computed sessionType,
      // attempt a safe fallback: find any existing attendance for the student
      // in this event that has no timeOut (likely the one we should time-out).
      // This makes the system more tolerant of session detection edge-cases
      // (timezones, misconfigured session windows, or client/session mismatches).
      let target: any = existing
      if (!target) {
        if (requestedSessionType) {
          // For explicit outs, look up attendance for the requested sessionType
          // with no timeOut and allow timing out regardless of session window.
          const explicitTarget = await prisma.attendance.findFirst({
            where: { studentId: student.id, eventId, sessionType: requestedSessionType, timeOut: null },
            orderBy: { createdAt: 'desc' }
          })

          if (!explicitTarget) {
            return NextResponse.json({ error: `No existing time-in for ${requestedSessionType} session` }, { status: 400 })
          }

          target = explicitTarget
          sessionType = requestedSessionType
        } else {
          // Auto-detection/fallback: find the most recent attendance for this student & event without timeOut
          // and validate it's eligible for time-out given session windows.
          const fallback = await prisma.attendance.findFirst({
            where: { studentId: student.id, eventId, timeOut: null },
            orderBy: { createdAt: 'desc' }
          })

          if (!fallback) {
            return NextResponse.json({ error: `No existing time-in for ${sessionType} session` }, { status: 400 })
          }

          const fallbackSession = fallback.sessionType || 'morning'

          target = fallback
          sessionType = fallbackSession
        }
      }
      if (target.timeOut) {
        return NextResponse.json({ error: `Student already timed out for ${sessionType} session` }, { status: 400 })
      }

      const updated = await prisma.attendance.update({
        where: { id: target.id },
        data: { timeOut: now }
      })
      console.log(`Attendance ${target.id} timed out at ${now.toISOString()} by scan out (resolved session: ${sessionType})`)

      try {
        await prisma.attendanceLog.create({
          data: {
            attendanceId: updated.id,
            eventId: eventId,
            studentId: student.id,
            action: 'out',
            previousTimeOut: target.timeOut || null,
            newTimeOut: now
          }
        })
      } catch (e) { console.error('attendanceLog create failed (out):', e) }

      // publish realtime event
      try {
        publishAttendance('out', { attendance: updated, student, event, sessionType })
      } catch (e) { }

      return NextResponse.json({ attendance: updated, student, event })
    }

    // Auto behaviour
    if (!existing) {
      // Auto-time-out based on session (prefer event-provided end times)
      let autoTimeOut = null
      if (sessionType === 'morning') {
        autoTimeOut = event.morningEnd ? new Date(event.morningEnd) : phMorningEnd
      } else if (sessionType === 'afternoon') {
        autoTimeOut = event.afternoonEnd ? new Date(event.afternoonEnd) : phAfternoonEnd
      }

      const attendance = await prisma.attendance.create({
        data: {
          studentId: student.id,
          eventId: eventId,
          sessionType,
          status,
          scannedAt: now
        }
      })

      // audit log for auto-created attendance
      try {
        await prisma.attendanceLog.create({
          data: {
            attendanceId: attendance.id,
            eventId: eventId,
            studentId: student.id,
            action: 'auto-in',
            newTimeOut: attendance.timeOut || null
          }
        })
      } catch (e) { console.error('attendanceLog create failed (auto-in):', e) }

      // publish realtime event for auto-in
      try { publishAttendance('auto-in', { attendance, student, event, sessionType, status }) } catch (e) {}

      return NextResponse.json({ attendance, student, event })
    }

    // Existing time-in: auto time-out if at or past session end time
    if (!existing.timeOut) {
      const updated = await prisma.attendance.update({
        where: { id: existing.id },
        data: { timeOut: now }
      })
      console.log(`Attendance ${existing.id} auto-timed out at ${now.toISOString()} (session ${sessionType})`)

      try {
        await prisma.attendanceLog.create({
          data: {
            attendanceId: existing.id,
            eventId: eventId,
            studentId: student.id,
            action: 'auto-out',
            previousTimeOut: existing.timeOut || null,
            newTimeOut: now
          }
        })
      } catch (e) { console.error('attendanceLog create failed (auto-out):', e) }

      // publish realtime event for auto-out
      try { publishAttendance('auto-out', { attendance: updated, student, event, sessionType }) } catch (e) {}

      return NextResponse.json({ attendance: updated, student, event })
    }

    return NextResponse.json({ error: `Student already timed out for ${sessionType} session` }, { status: 400 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    const reasonQuery = url.searchParams.get('reason')

    // allow JSON body fallback for clients that send JSON
    let bodyId = null
    let bodyReason = null
    let body: any = null
    try {
      body = await request.json().catch(() => null)
      if (body && body.id) bodyId = body.id
      if (body && body.reason) bodyReason = String(body.reason)
    } catch (e) {}

    const attendanceId = id || bodyId
    const reason = bodyReason || reasonQuery

    const eventIdParam = url.searchParams.get('eventId') || null
    const eventIdBody = body && body.eventId ? body.eventId : null
    const eventIdToDelete = eventIdParam || eventIdBody

    if (!attendanceId && !eventIdToDelete) return NextResponse.json({ error: 'Missing attendance id or eventId' }, { status: 400 })
    if (!reason || String(reason).trim().length === 0) return NextResponse.json({ error: 'Missing deletion reason' }, { status: 400 })

    // validate admin session/token (handle Vercel proxy secure cookie mismatch)
    const cookieHeader = request.headers.get('cookie') || ''
    const useSecure = cookieHeader.includes('__Secure-next-auth.session-token')
    const token = await getToken({ 
      req: request as any, 
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: useSecure,
      cookieName: useSecure ? '__Secure-next-auth.session-token' : 'next-auth.session-token'
    })
    if (!token || (token.role !== 'ADMIN' && token.role !== 'admin')) {
      return NextResponse.json({ 
        error: 'Unauthorized - admin required',
        debug: {
          hasToken: !!token,
          role: token?.role || null,
          username: token?.name || token?.email || token?.username || null,
          tokenKeys: token ? Object.keys(token) : []
        }
      }, { status: 403 })
    }

    // If caller requested deletion by eventId instead of single attendance id, handle bulk delete
    if (!attendanceId && (bodyReason || reasonQuery)) {
      // defensive: should not reach here because attendanceId check above, but keep for clarity
    }

    if (eventIdToDelete) {
      // bulk-delete attendances for the event: create logs first then delete
      const eventAttendances = await prisma.attendance.findMany({ where: { eventId: eventIdToDelete } })
      if (eventAttendances.length === 0) return NextResponse.json({ success: true, deleted: 0 })

      const metaObj: any = { reason: String(reason) }
      if (token && token.id) metaObj.deletedBy = token.id

      const logsData = eventAttendances.map(a => ({
        attendanceId: a.id,
        eventId: a.eventId,
        studentId: a.studentId,
        action: 'delete',
        previousTimeOut: a.timeOut || null,
        newTimeOut: null,
        meta: JSON.stringify(metaObj)
      }))

      try {
        await prisma.$transaction([
          prisma.attendanceLog.createMany({ data: logsData }),
          prisma.attendance.deleteMany({ where: { eventId: eventIdToDelete } })
        ])
      } catch (e) {
        console.error('bulk delete transaction failed:', e)
        return NextResponse.json({ error: 'Failed to delete attendances' }, { status: 500 })
      }

      // publish bulk delete event
      try {
        publishAttendance('delete_bulk', { eventId: eventIdToDelete, deleted: eventAttendances.length, attendanceIds: eventAttendances.map(a => a.id), meta: metaObj })
      } catch (e) {}

      return NextResponse.json({ success: true, deleted: eventAttendances.length })
    }

    const existing = await prisma.attendance.findUnique({ where: { id: attendanceId } })
    if (!existing) return NextResponse.json({ error: 'Attendance not found' }, { status: 404 })

    // create audit log entry for deletion (include reason and deleter id if available)
    try {
      const metaObj: any = { reason: String(reason) }
      if (token && token.id) metaObj.deletedBy = token.id

      await prisma.attendanceLog.create({
        data: {
          attendanceId: existing.id,
          eventId: existing.eventId,
          studentId: existing.studentId,
          action: 'delete',
          previousTimeOut: existing.timeOut || null,
          newTimeOut: null,
          meta: JSON.stringify(metaObj)
        }
      })
    } catch (e) { console.error('attendanceLog create failed (delete):', e) }

    await prisma.attendance.delete({ where: { id: attendanceId } })
    // publish single delete event
    try {
      const metaObj: any = { reason: String(reason) }
      if (token && token.id) metaObj.deletedBy = token.id
      publishAttendance('delete', { attendanceId, eventId: existing.eventId, studentId: existing.studentId, meta: metaObj })
    } catch (e) {}

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
