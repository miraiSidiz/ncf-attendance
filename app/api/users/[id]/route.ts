import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, username: true, role: true, createdAt: true } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    return NextResponse.json(user)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const body = await request.json()
    const { username, role, password } = body

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    if (username) {
      const clash = await prisma.user.findUnique({ where: { username } })
      if (clash && clash.id !== id) return NextResponse.json({ error: 'Username already exists' }, { status: 400 })
    }

    const data: any = { }
    if (username) data.username = username
    if (role) data.role = role
    if (password) data.password = await hashPassword(password)

    const updated = await prisma.user.update({ where: { id }, data, select: { id: true, username: true, role: true, createdAt: true } })
    return NextResponse.json(updated)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
