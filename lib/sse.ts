import EventEmitter from 'events'

// Single emitter instance to broadcast attendance events across server handlers
const sseEmitter = new EventEmitter()

// Increase default max listeners to avoid warnings in dev with many subscribers
sseEmitter.setMaxListeners(50)

export default sseEmitter

export function publishAttendance(event: string, payload: any) {
  try {
    sseEmitter.emit('attendance_event', { event, payload })
  } catch (e) {
    // ignore
  }
}
