import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    // Redirect to the sign-in page for nicer UX
    return NextResponse.redirect(new URL('/login', url).toString())
  } catch (e) {
    return NextResponse.json({ error: 'Auth error' }, { status: 400 })
  }
}

export async function POST(request: Request) {
  return NextResponse.json({ error: 'Auth error' }, { status: 400 })
}
