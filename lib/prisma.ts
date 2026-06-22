import { PrismaClient } from '@prisma/client'

// Robust sanitization to handle quotes pasted in Vercel and auto-inject pgbouncer flags
if (process.env.DATABASE_URL) {
  let url = process.env.DATABASE_URL.replace(/^['"]|['"]$/g, '').trim()
  
  // Force pgbouncer=true if connecting to the Supabase pooler (port 6543)
  if (url.includes(':6543') && !url.includes('pgbouncer=true')) {
    const separator = url.includes('?') ? '&' : '?'
    url = `${url}${separator}pgbouncer=true&connection_limit=1`
  }
  
  process.env.DATABASE_URL = url

  try {
    const urlParts = url.split('@')
    const host = urlParts[urlParts.length - 1]
    console.log('Prisma initialized. Target database host:', host)
  } catch (e) {}
}

if (process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DIRECT_URL.replace(/^['"]|['"]$/g, '').trim()
}

const prisma = new PrismaClient()

export default prisma
