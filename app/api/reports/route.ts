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

    // group attendances by studentId and sessionType
    const grouped = attendances.reduce((acc, a) => {
      if (!acc[a.studentId]) acc[a.studentId] = {}
      acc[a.studentId][a.sessionType || 'morning'] = a
      return acc
    }, {} as Record<string, Record<string, any>>)

    const report = students.map(student => {
      // defensive: ensure student fields are normalized (avoid accidental non-string values)
      const normalizedStudent = { ...student, yearLevel: student.yearLevel ? String(student.yearLevel) : '' }
      const g = grouped[student.id] || {}
      const morning = g['morning'] || null
      const afternoon = g['afternoon'] || null

      const morningId = morning?.id ?? null
      const morningIn = morning?.scannedAt ?? null
      const morningOut = morning?.timeOut ?? null
      const morningStatus = morning ? (morning.status ?? 'PRESENT') : 'ABSENT'

      const afternoonId = afternoon?.id ?? null
      const afternoonIn = afternoon?.scannedAt ?? null
      const afternoonOut = afternoon?.timeOut ?? null
      const afternoonStatus = afternoon ? (afternoon.status ?? 'PRESENT') : 'ABSENT'

      // determine overall status: prioritize PRESENT/LATE if any session has presence, EARLY_LEAVE if any session marked so, otherwise ABSENT
      let overall = 'ABSENT'
      if (morning || afternoon) {
        if (morningStatus === 'EARLY_LEAVE' || afternoonStatus === 'EARLY_LEAVE') overall = 'EARLY_LEAVE'
        else if (morningStatus === 'LATE' || afternoonStatus === 'LATE') overall = 'LATE'
        else overall = 'PRESENT'
      }

      return {
        student: normalizedStudent,
        morning: { id: morningId, in: morningIn, out: morningOut, status: morningStatus },
        afternoon: { id: afternoonId, in: afternoonIn, out: afternoonOut, status: afternoonStatus },
        status: overall
      }
    })

    return NextResponse.json({ event, report })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
