import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword, verifyPassword, generateToken } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const { action, username, password } = await request.json()

    if (action === 'login') {
      const user = await prisma.user.findUnique({ where: { username } })
      if (!user || !user.password || !password) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }

      const isValid = await verifyPassword(password, user.password)
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }

      const token = generateToken({ id: user.id, username: user.username as string, role: user.role })
      return NextResponse.json({ token, user: { id: user.id, username: user.username as string, role: user.role } })
    } else if (action === 'register') {
      const existingUser = await prisma.user.findUnique({ where: { username } })
      if (existingUser) {
        return NextResponse.json({ error: 'Username already exists' }, { status: 400 })
      }

      const hashedPassword = await hashPassword(password)
      const user = await prisma.user.create({
        data: {
          username,
          password: hashedPassword,
          role: 'ADMIN'
        }
      })

      const token = generateToken({ id: user.id, username: user.username as string, role: user.role })
      return NextResponse.json({ token, user: { id: user.id, username: user.username as string, role: user.role } })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
