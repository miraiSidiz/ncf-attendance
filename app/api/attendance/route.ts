import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

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

    // Define session times: morning (up to 12 noon), afternoon (1 PM onwards)
    const noonTime = new Date(now)
    noonTime.setHours(12, 0, 0, 0)
    const afterNoonTime = new Date(now)
    afterNoonTime.setHours(13, 0, 0, 0)

    // Determine session type from request or time of day
    let sessionType = requestedSessionType || 'morning'
    if (now >= afterNoonTime) {
      sessionType = 'afternoon'
    }

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

      // Auto-set time-out based on session
      let autoTimeOut = null
      if (sessionType === 'morning') {
        autoTimeOut = new Date(now)
        autoTimeOut.setHours(12, 0, 0, 0)
      } else if (sessionType === 'afternoon') {
        // Afternoon time-in at 1 PM
        autoTimeOut = new Date(now)
        autoTimeOut.setHours(17, 0, 0, 0) // 5 PM assumed end (or adjust as needed)
      }

      const attendance = await prisma.attendance.create({
        data: {
          studentId: student.id,
          eventId: eventId,
          sessionType,
          status,
          scannedAt: now,
          timeOut: autoTimeOut
        },
        include: { student: true, event: true }
      })

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

      // Check session-specific time-out windows
      if (sessionType === 'morning' && now < noonTime) {
        return NextResponse.json({ error: 'Morning time-out not available until 12 noon' }, { status: 400 })
      }
      if (sessionType === 'afternoon' && now < afterNoonTime) {
        return NextResponse.json({ error: 'Afternoon time-out not available until event end' }, { status: 400 })
      }

      const updated = await prisma.attendance.update({
        where: { id: existing.id },
        data: { timeOut: now }
      })

      return NextResponse.json({ attendance: updated, student, event })
    }

    // Auto behaviour
    if (!existing) {
      if (now < startDate) {
        return NextResponse.json({ error: 'Too early to time in' }, { status: 400 })
      }

      // Auto time-out based on session
      let autoTimeOut = null
      if (sessionType === 'morning') {
        autoTimeOut = new Date(now)
        autoTimeOut.setHours(12, 0, 0, 0) // 12 noon for morning
      } else if (sessionType === 'afternoon') {
        autoTimeOut = new Date(now)
        autoTimeOut.setHours(17, 0, 0, 0) // Assumed end time (adjust as needed)
      }

      const attendance = await prisma.attendance.create({
        data: {
          studentId: student.id,
          eventId: eventId,
          sessionType,
          status,
          scannedAt: now,
          timeOut: autoTimeOut
        },
        include: { student: true, event: true }
      })

      return NextResponse.json({ attendance, student, event })
    }

    // Existing time-in: auto time-out if at or past session end time
    if (!existing.timeOut) {
      const canTimeOut = (sessionType === 'morning' && now >= noonTime) ||
                        (sessionType === 'afternoon' && now >= afterNoonTime)

      if (!canTimeOut) {
        return NextResponse.json({ error: `Time-out not yet available for ${sessionType} session` }, { status: 400 })
      }

      const updated = await prisma.attendance.update({
        where: { id: existing.id },
        data: { timeOut: now }
      })

      return NextResponse.json({ attendance: updated, student, event })
    }

    return NextResponse.json({ error: `Student already timed out for ${sessionType} session` }, { status: 400 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
