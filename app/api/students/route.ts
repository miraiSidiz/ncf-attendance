import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const students = await prisma.student.findMany()
    return NextResponse.json(students)
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error', details: error.message || String(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Handle bulk upload
    if (Array.isArray(body)) {
      const students = await prisma.student.createMany({
        data: body.map((student) => ({
          name: student.name,
          studentId: student.studentId,
          photo: student.photo || null,
          email: student.email || null,
          gender: student.gender || null,
          qrCode: student.studentId,
          course: student.course || null,
          yearLevel: student.yearLevel || null,
          section: student.section || null,
        })),
      })
      return NextResponse.json({ count: students.count })
    }

    // Handle single student creation
    const { name, studentId, photo, email, gender, course, yearLevel, section } = body
    const student = await prisma.student.create({
      data: {
        name,
        studentId,
        photo,
        email,
        gender,
        qrCode: studentId,
        course: course || null,
        yearLevel: yearLevel || null,
        section: section || null,
      }
    })
    return NextResponse.json(student)
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error', details: error.message || String(error) }, { status: 500 })
  }
}
