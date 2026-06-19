import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getToken } from 'next-auth/jwt'

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
    
    const student = await prisma.student.findFirst({
      where: { qrCode }
    })

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId }
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const now = new Date()
    const startDate = new Date(event.startDate)
    const endDate = new Date(event.endDate)

    // Use event-specific session windows when available, otherwise fall back to defaults
    const morningEnd = event.morningEnd ? new Date(event.morningEnd) : (() => { const d = new Date(now); d.setHours(12,0,0,0); return d })()
    const afternoonStart = event.afternoonStart ? new Date(event.afternoonStart) : (() => { const d = new Date(now); d.setHours(13,0,0,0); return d })()
    const afternoonEnd = event.afternoonEnd ? new Date(event.afternoonEnd) : (() => { const d = new Date(now); d.setHours(17,0,0,0); return d })()

    // Determine session type from request or by comparing now with session windows
    let sessionType = requestedSessionType || (now >= afternoonStart ? 'afternoon' : 'morning')

    // Check for existing time-in for this session
    const existing = await prisma.attendance.findUnique({
      where: {
        studentId_eventId_sessionType: {
          studentId: student.id,
          eventId: eventId,
          sessionType: sessionType
        }
      },
      include: { event: true }
    })

    // Late if scanned > 30 min after event startDate
    const thirtyMinAfterStart = new Date(startDate.getTime() + 30 * 60 * 1000)
    let status = 'PRESENT'
    if (now > thirtyMinAfterStart) status = 'LATE'

    // Explicit time-in requested
    if (action === 'in') {
      if (now < startDate) {
        return NextResponse.json({ error: 'Too early to time in' }, { status: 400 })
      }
      if (existing && existing.scannedAt) {
        return NextResponse.json({ error: `Student already timed in for ${sessionType} session` }, { status: 400 })
      }

      // Auto-set time-out based on session (prefer event-specific end times)
      let autoTimeOut = null
      if (sessionType === 'morning') {
        autoTimeOut = event.morningEnd ? new Date(event.morningEnd) : morningEnd
      } else if (sessionType === 'afternoon') {
        autoTimeOut = event.afternoonEnd ? new Date(event.afternoonEnd) : afternoonEnd
      }

      const attendance = await prisma.attendance.create({
        data: {
          studentId: student.id,
          eventId: eventId,
          sessionType,
          status,
          scannedAt: now
        },
        include: { student: true, event: true }
      })

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

      return NextResponse.json({ attendance, student, event })
    }

    // Explicit time-out requested
    if (action === 'out') {
      if (!existing) {
        return NextResponse.json({ error: `No existing time-in for ${sessionType} session` }, { status: 400 })
      }
      if (existing.timeOut) {
        return NextResponse.json({ error: `Student already timed out for ${sessionType} session` }, { status: 400 })
      }

      // Check session-specific time-out windows (use event windows if present)
      if (sessionType === 'morning' && now < morningEnd) {
        return NextResponse.json({ error: 'Morning time-out not available until configured morning end time' }, { status: 400 })
      }
      if (sessionType === 'afternoon' && now < afternoonStart) {
        return NextResponse.json({ error: 'Afternoon time-out not available until configured afternoon start time' }, { status: 400 })
      }

      const updated = await prisma.attendance.update({
        where: { id: existing.id },
        data: { timeOut: now }
      })
      console.log(`Attendance ${existing.id} timed out at ${now.toISOString()} by scan out`)

      try {
        await prisma.attendanceLog.create({
          data: {
            attendanceId: existing.id,
            eventId: eventId,
            studentId: student.id,
            action: 'out',
            previousTimeOut: existing.timeOut || null,
            newTimeOut: now
          }
        })
      } catch (e) { console.error('attendanceLog create failed (out):', e) }

      return NextResponse.json({ attendance: updated, student, event })
    }

    // Auto behaviour
    if (!existing) {
      if (now < startDate) {
        return NextResponse.json({ error: 'Too early to time in' }, { status: 400 })
      }

      // Auto time-out based on session (prefer event-provided end times)
      let autoTimeOut = null
      if (sessionType === 'morning') {
        autoTimeOut = event.morningEnd ? new Date(event.morningEnd) : morningEnd
      } else if (sessionType === 'afternoon') {
        autoTimeOut = event.afternoonEnd ? new Date(event.afternoonEnd) : afternoonEnd
      }

      const attendance = await prisma.attendance.create({
        data: {
          studentId: student.id,
          eventId: eventId,
          sessionType,
          status,
          scannedAt: now
        },
        include: { student: true, event: true }
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

      return NextResponse.json({ attendance, student, event })
    }

    // Existing time-in: auto time-out if at or past session end time
    if (!existing.timeOut) {
      const canTimeOut = (sessionType === 'morning' && now >= morningEnd) || (sessionType === 'afternoon' && now >= afternoonStart)

      if (!canTimeOut) {
        return NextResponse.json({ error: `Time-out not yet available for ${sessionType} session` }, { status: 400 })
      }

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
    try {
      const body = await request.json().catch(() => null)
      if (body && body.id) bodyId = body.id
      if (body && body.reason) bodyReason = String(body.reason)
    } catch (e) {}

    const attendanceId = id || bodyId
    const reason = bodyReason || reasonQuery
    if (!attendanceId) return NextResponse.json({ error: 'Missing attendance id' }, { status: 400 })
    if (!reason || String(reason).trim().length === 0) return NextResponse.json({ error: 'Missing deletion reason' }, { status: 400 })

    // validate admin session/token
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    if (!token || (token.role !== 'ADMIN' && token.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized - admin required' }, { status: 403 })
    }

    // If caller requested deletion by eventId instead of single attendance id, handle bulk delete
    if (!attendanceId && (bodyReason || reasonQuery)) {
      // defensive: should not reach here because attendanceId check above, but keep for clarity
    }

    const eventIdParam = url.searchParams.get('eventId') || (bodyId ? null : null)
    let eventIdBody = null
    try {
      const body = await request.json().catch(() => null)
      if (body && body.eventId) eventIdBody = body.eventId
    } catch (e) {}
    const eventIdToDelete = eventIdParam || eventIdBody
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
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
