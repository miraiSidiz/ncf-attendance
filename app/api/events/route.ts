import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const scope = url.searchParams.get('scope')

    if (scope === 'scan') {
      // only return active events that haven't ended
      const now = new Date()
      const events = await prisma.event.findMany({
        where: {
          active: true,
          endDate: { gte: now }
        },
        orderBy: { startDate: 'desc' }
      })
      return NextResponse.json(events)
    }

    const events = await prisma.event.findMany({
      orderBy: { startDate: 'desc' }
    })
    return NextResponse.json(events)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { title, description, startDate, endDate } = await request.json()
    const event = await prisma.event.create({
      data: {
        title,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        active: true
      }
    })
    return NextResponse.json(event)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')

    const body = await request.json().catch(() => ({}))

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const data: any = {}
    if (body.title !== undefined) data.title = body.title
    if (body.description !== undefined) data.description = body.description
    if (body.startDate !== undefined) data.startDate = new Date(body.startDate)
    if (body.endDate !== undefined) data.endDate = new Date(body.endDate)
    if (body.active !== undefined) data.active = Boolean(body.active)

    const updated = await prisma.event.update({
      where: { id },
      data
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const event = await prisma.event.findUnique({ where: { id } })
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    const now = new Date()
    const isOngoing = new Date(event.startDate) <= now && now <= new Date(event.endDate)

    if (event.active && isOngoing) {
      return NextResponse.json({ error: 'Cannot delete an active event that is currently ongoing' }, { status: 400 })
    }

    await prisma.event.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
