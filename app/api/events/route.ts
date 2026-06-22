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
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error', details: error.message || String(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { title, description, startDate, endDate, morningStart, morningEnd, afternoonStart, afternoonEnd, useSessions } = await request.json()
    // basic validation
    const missing: string[] = []
    if (!title) missing.push('title')
    if (!startDate) missing.push('startDate')
    if (!endDate) missing.push('endDate')
    if (missing.length > 0) {
      return NextResponse.json({ error: 'Missing required fields', missing }, { status: 400 })
    }
    const s = new Date(startDate)
    const e = new Date(endDate)
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) {
      return NextResponse.json({ error: 'Invalid startDate/endDate', details: { startDate, endDate } }, { status: 400 })
    }
    // validate session ranges if provided
    const parseMaybeDate = (v: any) => v ? new Date(v) : null
    const ms = parseMaybeDate(morningStart)
    const me = parseMaybeDate(morningEnd)
    const as = parseMaybeDate(afternoonStart)
    const ae = parseMaybeDate(afternoonEnd)
    if (ms && me && (isNaN(ms.getTime()) || isNaN(me.getTime()) || ms >= me)) {
      return NextResponse.json({ error: 'Invalid morningStart/morningEnd range', details: { morningStart, morningEnd } }, { status: 400 })
    }
    if (as && ae && (isNaN(as.getTime()) || isNaN(ae.getTime()) || as >= ae)) {
      return NextResponse.json({ error: 'Invalid afternoonStart/afternoonEnd range', details: { afternoonStart, afternoonEnd } }, { status: 400 })
    }
    if ((ms && (ms < s || ms > e)) || (me && (me < s || me > e)) || (as && (as < s || as > e)) || (ae && (ae < s || ae > e))) {
      return NextResponse.json({ error: 'Session times must be within event start and end', details: { startDate, endDate, morningStart, morningEnd, afternoonStart, afternoonEnd } }, { status: 400 })
    }
    const data: any = {
      title,
      description,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      active: true
    }
    if (morningStart) data.morningStart = new Date(morningStart)
    if (morningEnd) data.morningEnd = new Date(morningEnd)
    if (afternoonStart) data.afternoonStart = new Date(afternoonStart)
    if (afternoonEnd) data.afternoonEnd = new Date(afternoonEnd)
    if (useSessions !== undefined) data.useSessions = Boolean(useSessions)

    const event = await prisma.event.create({ data })
    return NextResponse.json(event)
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error', details: error.message || String(error) }, { status: 500 })
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
    // server-side validation for updates: if dates or session times provided, validate ranges
    const toDate = (v: any) => v ? new Date(v) : null
    const newStart = body.startDate !== undefined ? toDate(body.startDate) : null
    const newEnd = body.endDate !== undefined ? toDate(body.endDate) : null
    // fetch existing to validate against if needed
    const existing = await prisma.event.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    const baseStart = newStart || existing.startDate
    const baseEnd = newEnd || existing.endDate
    if (newStart && newEnd && (isNaN(baseStart.getTime()) || isNaN(baseEnd.getTime()) || baseStart > baseEnd)) {
      return NextResponse.json({ error: 'Invalid startDate/endDate' }, { status: 400 })
    }
    if (body.morningStart !== undefined) {
      const msi = body.morningStart ? toDate(body.morningStart) : null
      if (msi && (isNaN(msi.getTime()) || msi < baseStart || msi > baseEnd)) return NextResponse.json({ error: 'Invalid morningStart' }, { status: 400 })
      data.morningStart = msi
    }
    if (body.morningEnd !== undefined) {
      const mei = body.morningEnd ? toDate(body.morningEnd) : null
      if (mei && (isNaN(mei.getTime()) || mei < baseStart || mei > baseEnd)) return NextResponse.json({ error: 'Invalid morningEnd' }, { status: 400 })
      data.morningEnd = mei
    }
    if (body.afternoonStart !== undefined) {
      const asi = body.afternoonStart ? toDate(body.afternoonStart) : null
      if (asi && (isNaN(asi.getTime()) || asi < baseStart || asi > baseEnd)) return NextResponse.json({ error: 'Invalid afternoonStart' }, { status: 400 })
      data.afternoonStart = asi
    }
    if (body.afternoonEnd !== undefined) {
      const aei = body.afternoonEnd ? toDate(body.afternoonEnd) : null
      if (aei && (isNaN(aei.getTime()) || aei < baseStart || aei > baseEnd)) return NextResponse.json({ error: 'Invalid afternoonEnd' }, { status: 400 })
      data.afternoonEnd = aei
    }
    if (body.useSessions !== undefined) data.useSessions = Boolean(body.useSessions)

    const updated = await prisma.event.update({
      where: { id },
      data
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error', details: error.message || String(error) }, { status: 500 })
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

    // prevent deleting events that already have attendance records
    const attendanceCount = await prisma.attendance.count({ where: { eventId: id } })
    if (attendanceCount > 0) {
      return NextResponse.json({ error: 'Cannot delete event with recorded attendances' }, { status: 400 })
    }

    await prisma.event.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error', details: error.message || String(error) }, { status: 500 })
  }
}
