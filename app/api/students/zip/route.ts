import JSZip from 'jszip'
import QRCode from 'qrcode'
import prisma from '@/lib/prisma'

export async function GET() {
  const students = await prisma.student.findMany()
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

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="qrcodes_${new Date().toISOString().slice(0,10)}.zip"`,
    },
  })
}
