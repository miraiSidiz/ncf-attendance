import JSZip from 'jszip'
import QRCode from 'qrcode'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const course = searchParams.get('course')
  const search = searchParams.get('search')
  
  let where: any = {}
  if (course) where.course = course
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { studentId: { contains: search, mode: 'insensitive' } }
    ]
  }

  const students = await prisma.student.findMany({ where })
  const zip = new JSZip()

  for (const s of students) {
    const value = s.qrCode || s.studentId || s.id
    try {
      const buffer = await QRCode.toBuffer(value, { width: 512 })
      const filename = (s.name || s.studentId || s.id).replace(/[^a-z0-9-_. ]/gi, '_') + '.png'
      zip.file(filename, buffer)
    } catch (err) {
      console.error('QR generation failed for', s.id, err)
    }
  }

  const content = await zip.generateAsync({ type: 'nodebuffer' })
  const uint8 = new Uint8Array(content as any)

  return new Response(uint8, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="qrcodes_${new Date().toISOString().slice(0,10)}.zip"`,
    },
  })
}
