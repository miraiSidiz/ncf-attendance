export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import sseEmitter from '@/lib/sse'

export async function GET(request: Request) {
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive'
  })

  const stream = new ReadableStream({
    start(controller) {
      const onEvent = (payload: any) => {
        try {
          controller.enqueue(`data: ${JSON.stringify(payload)}\n\n`)
        } catch (e) {}
      }

      sseEmitter.on('attendance_event', onEvent)

      // send a comment ping periodically to keep connection alive
      const ping = setInterval(() => {
        try { controller.enqueue(': ping\n\n') } catch (e) {}
      }, 15000)

      // When the client disconnects, clean up
      const abortHandler = () => {
        sseEmitter.off('attendance_event', onEvent)
        clearInterval(ping)
        try { controller.close() } catch (e) {}
      }

      request.signal.addEventListener('abort', abortHandler)
    }
  })

  return new Response(stream, { headers })
}
