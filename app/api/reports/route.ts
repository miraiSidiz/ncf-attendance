import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get('eventId')

  if (!eventId) {
    return NextResponse.json({ error: 'Event ID is required' }, { status: 400 })
  }

  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId }
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const students = await prisma.student.findMany()
    const attendances = await prisma.attendance.findMany({
      where: { eventId },
      include: { student: true }
    })

    const attendanceMap = new Map(attendances.map(a => [a.studentId, a]))

    const report = students.map(student => {
      const attendance = attendanceMap.get(student.id)
      let status = 'ABSENT'
      let scannedAt = null
      let timeOut = null

      if (attendance) {
        scannedAt = attendance.scannedAt ?? null
        timeOut = attendance.timeOut ?? null

        // base status from scannedAt (PRESENT/LATE)
        status = attendance.status ?? 'PRESENT'

        // if there is a timeOut earlier than event end, mark as EARLY_LEAVE
        if (timeOut && new Date(timeOut) < new Date(event.endDate)) {
          status = 'EARLY_LEAVE'
        }
      }

      return {
        student,
        status,
        scannedAt,
        timeOut
      }
    })

    return NextResponse.json({ event, report })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
