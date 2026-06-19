import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const logs = await prisma.attendanceLog.findMany({
      orderBy: { createdAt: 'desc' },
      include: { attendance: true }
    })
    return NextResponse.json({ logs })
  } catch (error) {
    console.error('attendance-logs:get', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
