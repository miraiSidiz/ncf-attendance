import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const events = await prisma.event.findMany({ orderBy: { startDate: 'desc' } })
    const totalStudents = await prisma.student.count()

    const summary = [] as any[]

    // load all students grouped by course
    const allStudents = await prisma.student.findMany({ select: { id: true, course: true, yearLevel: true } })
    const studentsByCourse: Record<string, string[]> = {}
    allStudents.forEach(s => {
      const course = s.course || 'Unassigned'
      if (!studentsByCourse[course]) studentsByCourse[course] = []
      studentsByCourse[course].push(s.id)
    })

    for (const ev of events) {
      const atts = await prisma.attendance.findMany({ where: { eventId: ev.id }, select: { studentId: true, status: true, sessionType: true } })

      // map studentId -> { morning: status|null, afternoon: status|null }
      const attMap: Record<string, { morning?: string | null; afternoon?: string | null }> = {}
      atts.forEach(a => {
        if (!attMap[a.studentId]) attMap[a.studentId] = {}
        ;(attMap[a.studentId] as any)[a.sessionType || 'morning'] = a.status
      })

      const courseStats: any[] = []
      for (const [course, studentIds] of Object.entries(studentsByCourse)) {
        let morningLate = 0
        let afternoonLate = 0
        let morningPresentCount = 0
        let afternoonPresentCount = 0

        studentIds.forEach(sid => {
          const rec = attMap[sid]
          if (rec && rec.morning) {
            morningPresentCount++
            if (rec.morning === 'LATE') morningLate++
          }
          if (rec && rec.afternoon) {
            afternoonPresentCount++
            if (rec.afternoon === 'LATE') afternoonLate++
          }
        })

        const morningAbsent = Math.max(0, studentIds.length - morningPresentCount)
        const afternoonAbsent = Math.max(0, studentIds.length - afternoonPresentCount)

        courseStats.push({ course, totalStudents: studentIds.length, morningLate, morningAbsent, afternoonLate, afternoonAbsent })
      }

      summary.push({ event: ev, totalStudents, courseStats })
    }

    return NextResponse.json({ summary })
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error', details: error.message || String(error) }, { status: 500 })
  }
}
