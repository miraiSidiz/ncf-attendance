'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { useSession } from 'next-auth/react'
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library'

interface Event {
  id: string
  title: string
  endDate?: string
}

interface Student {
  id: string
  name: string
  photo?: string
}

interface Attendance {
  id: string
  studentId: string
  eventId: string
  status: string
  scannedAt?: string | null
  timeOut?: string | null
  createdAt: string
}
export default function ScanPage() {
  const { data: session, status } = useSession()
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState<string>('')
  const [scanning, setScanning] = useState(false)
  const [scannedStudent, setScannedStudent] = useState<Student | null>(null)
  const [scannedAttendance, setScannedAttendance] = useState<Attendance | null>(null)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [scanMode, setScanMode] = useState<'auto' | 'in' | 'out'>('auto')
  const [sessionType, setSessionType] = useState<'morning' | 'afternoon'>('morning')
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [hasGetUserMediaCompat, setHasGetUserMediaCompat] = useState<boolean>(false)
  const [cameraAllowed, setCameraAllowed] = useState<boolean>(false)
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false)
  const [autoStart, setAutoStart] = useState<boolean>(true)
  const [showPermissionHelp, setShowPermissionHelp] = useState<boolean>(false)
  const [diagnostics, setDiagnostics] = useState<any | null>(null)
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState<boolean>(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [confirming, setConfirming] = useState(false)
  const [confirmStudent, setConfirmStudent] = useState<Student | null>(null)
  const [confirmAction, setConfirmAction] = useState<'in' | 'out' | null>(null)
  const [pendingQr, setPendingQr] = useState<string | null>(null)
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null)
  const router = useRouter()
  const [deviceProbeResults, setDeviceProbeResults] = useState<Record<string,string>>({})
  const [notFoundCount, setNotFoundCount] = useState(0)
  const [toast, setToast] = useState<{ text: string; actionLabel?: string; action?: () => void } | null>(null)

  const scanModeRef = useRef(scanMode)
  const sessionTypeRef = useRef(sessionType)
  const selectedEventRef = useRef(selectedEvent)

  useEffect(() => { scanModeRef.current = scanMode }, [scanMode])
  useEffect(() => { sessionTypeRef.current = sessionType }, [sessionType])
  useEffect(() => { selectedEventRef.current = selectedEvent }, [selectedEvent])

  // Auto-detect session based on time of day
  useEffect(() => {
    const now = new Date()
    const afterNoon = new Date(now)
    afterNoon.setHours(13, 0, 0, 0) // 1 PM
    setSessionType(now >= afterNoon ? 'afternoon' : 'morning')
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events?scope=scan')
      const data = await res.json()
      setEvents(data)
      if (data && data.length > 0 && !selectedEvent) {
        setSelectedEvent(data[0].id)
      }
    } catch (error) {
      console.error(error)
    }
  }

  const confirmTimeOut = async (confirm: boolean) => {
    if (!confirm) {
      setConfirming(false)
      setConfirmStudent(null)
      setPendingQr(null)
      setConfirmAction(null)
      return
    }

    const currentSelectedEvent = selectedEventRef.current
    const currentSessionType = sessionTypeRef.current

    if (!pendingQr || !currentSelectedEvent || !confirmAction) {
      setMessage({ text: 'Missing data for confirmation', type: 'error' })
      setConfirming(false)
      return
    }

    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCode: pendingQr, eventId: currentSelectedEvent, action: confirmAction, sessionType: currentSessionType })
      })
      if (res.ok) {
        const data = await res.json()
        setScannedStudent(data.student)
        setScannedAttendance(data.attendance)
        setMessage({ text: `${confirmAction === 'out' ? 'Time-out' : 'Time-in'} recorded for ${data.student.name}`, type: 'success' })
        try { if (typeof navigator !== 'undefined' && (navigator as any).vibrate) (navigator as any).vibrate(50) } catch (e) {}
      } else {
        const data = await res.json()
        setMessage({ text: data.error || 'Failed to record attendance', type: 'error' })
      }
    } catch (err) {
      console.error(err)
      setMessage({ text: 'Failed to record attendance', type: 'error' })
    } finally {
      setConfirming(false)
      setConfirmStudent(null)
      setPendingQr(null)
      setConfirmAction(null)
    }
  }

  useEffect(() => {
    if (session) {
      fetchEvents()
      codeReaderRef.current = new BrowserMultiFormatReader()
      // feature-detect getUserMedia (including older prefixed APIs) and polyfill if needed
      const hasModern = typeof navigator !== 'undefined' && !!(navigator.mediaDevices && (navigator.mediaDevices as any).getUserMedia)
      const hasPrefixed = typeof navigator !== 'undefined' && (!!(navigator as any).getUserMedia || !!(navigator as any).webkitGetUserMedia || !!(navigator as any).mozGetUserMedia)
      if (!hasModern && hasPrefixed) {
        const legacyGet = (navigator as any).getUserMedia || (navigator as any).webkitGetUserMedia || (navigator as any).mozGetUserMedia
        try {
          if (legacyGet) {
            if (!(navigator as any).mediaDevices) (navigator as any).mediaDevices = {}
            if (!(navigator as any).mediaDevices.getUserMedia) {
              (navigator as any).mediaDevices.getUserMedia = function (constraints: any) {
                return new Promise((resolve: any, reject: any) => {
                  legacyGet.call(navigator, constraints, resolve, reject)
                })
              }
            }
          } else {
            // no legacy getUserMedia function available
          }
        } catch (err) {
          console.error('Could not polyfill legacy getUserMedia', err)
        }
      }
      setHasGetUserMediaCompat(!!(typeof navigator !== 'undefined' && navigator.mediaDevices && (navigator.mediaDevices as any).getUserMedia))
      // load autoStart preference from localStorage
      try {
        if (typeof window !== 'undefined') {
          const stored = window.localStorage.getItem('scan.autoStart')
          if (stored !== null) setAutoStart(stored === 'true')
        }
      } catch (e) {
        // ignore
      }
      // enumerate video input devices for camera selection
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        navigator.mediaDevices.enumerateDevices()
          .then((list) => {
            const cams = list.filter((d) => d.kind === 'videoinput')
            setDevices(cams)
            if (cams.length && !deviceId) setDeviceId(cams[0].deviceId)
          })
          .catch((err) => {
            console.error('Could not enumerate devices', err)
          })
      }
    }
    return () => {
      if (codeReaderRef.current) {
        codeReaderRef.current.reset()
      }
    }
  }, [session])

  // Show a friendly hint after several failed decode attempts
  useEffect(() => {
    if (notFoundCount >= 6) {
      setMessage({ text: 'No QR detected — try moving the camera closer/farther, improving lighting, or switching camera.', type: 'error' })
      setToast({ text: 'Try switching camera or capture a photo', actionLabel: 'Switch Camera', action: switchCamera })
    }
  }, [notFoundCount])

  const handleFileUpload = async (file: File | null) => {
    if (!file || !codeReaderRef.current) return
    try {
      setMessage(null)
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.src = url
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej })
      // try decoding from the image element
      try {
        const result = await codeReaderRef.current.decodeFromImageElement(img)
        if (result) {
          handleScan(result.getText())
        }
      } catch (err) {
        console.error('Image decode failed', err)
        setMessage({ text: 'Could not decode QR from the uploaded image.', type: 'error' })
      } finally {
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error(err)
      setMessage({ text: 'Failed to read the uploaded file.', type: 'error' })
    }
  }

  const probeDevices = async () => {
    const results: Record<string,string> = {}
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const list = await navigator.mediaDevices.enumerateDevices()
        const cams = list.filter((d) => d.kind === 'videoinput')
        for (const cam of cams) {
          try {
            const ok = await testDeviceAvailable(cam.deviceId)
            results[cam.deviceId || cam.label || 'unknown'] = ok ? 'ok' : 'unavailable'
          } catch (e) {
            results[cam.deviceId || cam.label || 'unknown'] = 'error'
          }
        }
      }
    } catch (err) {
      console.error('probeDevices failed', err)
    }
    setDeviceProbeResults(results)
  }

  const testDeviceAvailable = async (dId: string | null) => {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !(navigator.mediaDevices as any).getUserMedia) return false
      const constraints: any = dId
        ? { video: { deviceId: { exact: dId }, facingMode: { ideal: 'environment' } } }
        : { video: { facingMode: { ideal: 'environment' } } }
      const stream = await (navigator.mediaDevices as any).getUserMedia(constraints)
      stream.getTracks().forEach((t: MediaStreamTrack) => t.stop())
      return true
    } catch (e) {
      return false
    }
  }

  const gatherDiagnostics = async () => {
    const result: any = {}
    try {
      result.userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null
      result.platform = typeof navigator !== 'undefined' ? (navigator as any).platform : null
      result.mediaDevices = typeof navigator !== 'undefined' && navigator.mediaDevices ? {
        hasEnumerate: !!navigator.mediaDevices.enumerateDevices,
        hasGetUserMedia: !!(navigator.mediaDevices as any).getUserMedia
      } : null
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const list = await navigator.mediaDevices.enumerateDevices()
        result.devices = list.map(d => ({ kind: d.kind, label: d.label, deviceId: d.deviceId }))
      }
      if (typeof navigator !== 'undefined' && (navigator as any).permissions && (navigator as any).permissions.query) {
        try {
          const p = await (navigator as any).permissions.query({ name: 'camera' })
          result.cameraPermissionState = p.state
        } catch (e) {
          result.cameraPermissionState = 'unknown'
        }
      }
    } catch (err) {
      result.error = String(err)
    }
    return result
  }

  const startScanning = async () => {
    if (!selectedEvent) {
      setMessage({ text: 'Please select an event first', type: 'error' })
      return
    }

    if (!codeReaderRef.current || !videoRef.current) return

    // Ensure Media Devices API is available (modern or prefixed)
    if (!hasGetUserMediaCompat) {
      setMessage({ text: 'Camera API not available in this browser. You can upload a photo of the QR code instead.', type: 'error' })
      setScanning(false)
      return
    }

    

    const tryDevicesAndStart = async () => {
      // ensure we have an up-to-date device list
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const list = await navigator.mediaDevices.enumerateDevices()
          const cams = list.filter((d) => d.kind === 'videoinput')
          setDevices(cams)
        }
      } catch (e) {
        console.error('Could not refresh devices', e)
      }

      const tryList = devices.length ? devices : []
              for (const dev of tryList) {
        const ok = await testDeviceAvailable(dev.deviceId)
        if (ok) {
          setDeviceId(dev.deviceId)
          try {
            if (codeReaderRef.current && videoRef.current) {
              codeReaderRef.current.reset()
              // warm-up camera with higher resolution before handing to ZXing
              try {
                const hiResConstraints: any = { video: { deviceId: { exact: dev.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: { ideal: 'environment' } } }
                const tmpStream = await navigator.mediaDevices.getUserMedia(hiResConstraints)
                // attach briefly to the video element to improve camera selection
                if (videoRef.current) videoRef.current.srcObject = tmpStream
                tmpStream.getTracks().forEach((t) => t.stop())
              } catch (e) {
                // ignore warm-up errors, continue to start ZXing
              }
                      codeReaderRef.current.decodeFromVideoDevice(dev.deviceId, videoRef.current, (result, err) => {
                        if (result) {
                          setNotFoundCount(0)
                          handleScan(result.getText())
                        }
                        if (err) {
                          // suppress noisy NotFound exceptions; track them to show a helpful hint
                          if ((err as any)?.name === 'NotFoundException' || err instanceof NotFoundException) {
                            setNotFoundCount(c => c + 1)
                            return
                          }
                          console.error(err)
                        }
                      })
              setScanning(true)
              setMessage(null)
              return true
            }
          } catch (e) {
            console.error('Failed to start on device', dev.deviceId, e)
          }
        }
      }

      // try default device (null)
      const okDefault = await testDeviceAvailable(null)
      if (okDefault) {
        try {
          if (codeReaderRef.current && videoRef.current) {
            codeReaderRef.current.reset()
            codeReaderRef.current.decodeFromVideoDevice(null, videoRef.current, (result, err) => {
              if (result) handleScan(result.getText())
              if (err) console.error(err)
            })
            setScanning(true)
            setMessage(null)
            return true
          }
        } catch (e) {
          console.error('Failed to start default device', e)
        }
      }

      return false
    }

    try {
      setScanning(true)
      setMessage(null)
      // if no device selected, try all devices
      if (!deviceId) {
        const started = await tryDevicesAndStart()
        if (!started) {
          setMessage({ text: 'No available camera found. Try uploading a QR image or check device permissions.', type: 'error' })
          setScanning(false)
        }
        return
      }

      // attempt a hi-res permission warmup to improve decode reliability
      try {
        const constraints: any = deviceId
          ? { video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: { ideal: 'environment' } } }
          : { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: { ideal: 'environment' } } }
        const warm = await navigator.mediaDevices.getUserMedia(constraints)
        if (videoRef.current) videoRef.current.srcObject = warm
        warm.getTracks().forEach((t) => t.stop())
      } catch (e) {
        // non-fatal; ZXing will still try with default constraints
      }

      await codeReaderRef.current.decodeFromVideoDevice(deviceId ?? null, videoRef.current, async (result, err) => {
        if (result) {
          setNotFoundCount(0)
          handleScan(result.getText())
        }
        if (err) {
          const name = (err && err.name) || ''
          // treat ZXing not-found exceptions as transient; count them and show a hint after a few
          if ((err as any)?.name === 'NotFoundException' || err instanceof NotFoundException) {
            setNotFoundCount(c => c + 1)
            return
          }
          console.error(err)
          if (name === 'NotFoundError' || name === 'NotReadableError') {
            // attempt other cameras automatically
            const fallbackStarted = await tryDevicesAndStart()
            if (!fallbackStarted) {
              setMessage({ text: 'Camera not found or unavailable. Check camera device and permissions.', type: 'error' })
              setScanning(false)
            }
            return
          } else if (name === 'NotAllowedError' || name === 'SecurityError') {
            setMessage({ text: 'Camera access denied. Allow camera permission for this site.', type: 'error' })
            setScanning(false)
            return
          } else {
            setMessage({ text: 'Failed to start camera: ' + (err && err.message ? err.message : String(err)), type: 'error' })
            setScanning(false)
            return
          }
        }
      })
    } catch (error) {
      console.error(error)
      const emsg = (error as any)?.message || String(error)
      if (emsg.includes('getUserMedia')) {
        setMessage({ text: 'Failed to start camera. Camera API appears unavailable or blocked. Check browser permissions and that no other app is using the camera.', type: 'error' })
      } else {
        setMessage({ text: 'Failed to start camera: ' + emsg, type: 'error' })
      }
      setScanning(false)
    }
  }

  const stopScanning = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset()
    }
    setScanning(false)
  }

  const handleScan = async (qrCode: string) => {
    const currentScanMode = scanModeRef.current
    const currentSessionType = sessionTypeRef.current
    const currentSelectedEvent = selectedEventRef.current

    try {
      stopScanning()
      // If forcing Time In/Out, fetch student info and show confirmation before sending
      if (currentScanMode === 'out' || currentScanMode === 'in') {
        try {
          const studentsRes = await fetch('/api/students')
          const students = await studentsRes.json()
          const student = students.find((s: any) => s.qrCode === qrCode)
          if (!student) {
            setMessage({ text: 'Student not found for this QR', type: 'error' })
            return
          }
          setConfirmStudent(student)
          setPendingQr(qrCode)
          setConfirmAction(currentScanMode)
          setConfirming(true)
          return
        } catch (err) {
          console.error('Lookup failed', err)
          setMessage({ text: 'Failed to lookup student', type: 'error' })
          return
        }
      }

      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCode, eventId: currentSelectedEvent, action: currentScanMode !== 'auto' ? currentScanMode : undefined, sessionType: currentSessionType })
      })

      if (res.ok) {
        const data = await res.json()
        setScannedStudent(data.student)
        setScannedAttendance(data.attendance)

        // Choose message based on whether this was a time-in or time-out
        const acted = data.attendance?.timeOut ? 'Time-out recorded' : 'Attendance recorded'
        setMessage({ text: `${acted} for ${data.student.name}`, type: 'success' })
        try { if (typeof navigator !== 'undefined' && (navigator as any).vibrate) (navigator as any).vibrate(50) } catch (e) {}
      } else {
        const data = await res.json()
        setMessage({ text: data.error || 'Failed to record attendance', type: 'error' })
      }
    } catch (error) {
      console.error(error)
      setMessage({ text: 'Failed to record attendance', type: 'error' })
    }
  }

  const switchCamera = async () => {
    if (!devices || devices.length <= 1) return
    const idx = devices.findIndex(d => d.deviceId === deviceId)
    const next = devices[(idx + 1) % devices.length]
    setDeviceId(next.deviceId)
    setNotFoundCount(0)
    setToast(null)
    // restart scanning to pick up the new device
    if (scanning) {
      stopScanning()
      // give a small pause to allow reset
      setTimeout(() => startScanning().catch(()=>{}), 300)
    }
  }

  const handleCapture = async () => {
    if (!videoRef.current || !codeReaderRef.current) return
    try {
      const video = videoRef.current
      const w = video.videoWidth || 1280
      const h = video.videoHeight || 720
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not get canvas context')
      ctx.drawImage(video, 0, 0, w, h)
      const dataUrl = canvas.toDataURL('image/png')
      const img = new Image()
      img.src = dataUrl
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej })
      try {
        const result = await codeReaderRef.current.decodeFromImageElement(img)
        if (result) {
          handleScan(result.getText())
        }
      } catch (err) {
        setMessage({ text: 'No QR detected in the captured photo. Try again or switch camera.', type: 'error' })
      }
    } catch (err) {
      console.error('Capture failed', err)
      setMessage({ text: 'Failed to capture photo for decoding.', type: 'error' })
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-64 flex-1 p-8 bg-gray-50">
        <h1 className="text-3xl font-bold mb-6">Scan QR Code</h1>

        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Event</label>
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={scanning}
            >
              <option value="">-- Select an event --</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>{event.title}</option>
              ))}
            </select>
          </div>

          {devices.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Camera</label>
              <select
                value={deviceId ?? ''}
                onChange={(e) => setDeviceId(e.target.value || null)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={scanning}
              >
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-6">
            <h4 className="text-sm font-medium mb-2">Diagnostics</h4>
            <div className="text-xs text-gray-600">

          {/* Scan Mode control removed — replaced by explicit session buttons below to avoid conflicting state */}
              <p>Detected cameras: {devices.length}</p>
              <ul className="list-disc ml-6">
                {devices.map(d => (
                  <li key={d.deviceId}>{d.label || d.deviceId} — {deviceProbeResults[d.deviceId] ?? 'unknown'}</li>
                ))}
              </ul>
              <div className="mt-2">
                <button onClick={probeDevices} className="px-3 py-1 bg-gray-200 rounded">Probe Devices</button>
                <button onClick={() => { setDeviceProbeResults({}); probeDevices(); }} className="ml-2 px-3 py-1 bg-blue-100 rounded">Refresh & Probe</button>
                <button onClick={async () => { const d = await gatherDiagnostics(); setDiagnostics(d); setShowDiagnosticsModal(true) }} className="ml-2 px-3 py-1 bg-green-100 rounded">Run Diagnostics</button>
              </div>
            </div>
          </div>

          {!hasGetUserMediaCompat && (
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-2">Camera API not available — you can upload an image containing the QR code instead.</p>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e.target.files ? e.target.files[0] : null)}
                className="w-full"
                disabled={scanning}
              />
            </div>
          )}

          {permissionDenied && (
            <div className="mt-4 p-4 rounded bg-yellow-50 border border-yellow-200">
              <p className="text-sm text-yellow-800">Camera permission is denied. To enable scanning, allow camera access for this site in your browser settings.</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => setShowPermissionHelp(true)} className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded">How to enable</button>
                <button onClick={() => { setPermissionDenied(false); setMessage(null) }} className="px-3 py-1 bg-gray-100 rounded">Dismiss</button>
              </div>
            </div>
          )}

          {showPermissionHelp && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-xl">
                <h3 className="text-lg font-semibold mb-4">Enable Camera Access</h3>
                <p className="mb-2">Follow these steps to enable camera access for this site:</p>
                {(() => {
                  // simple platform detection
                  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
                  const isAndroid = /Android/i.test(ua)
                  const isIOS = /iPhone|iPad|iPod/i.test(ua)
                  if (isAndroid) {
                    return (
                      <ul className="list-disc ml-6 text-sm mb-4">
                        <li>On Android Chrome: tap the lock icon in the address bar → Site settings → Camera → Allow.</li>
                        <li>If you don't see the lock icon, open browser settings → Site settings → Camera.</li>
                        <li>Reload the page after changing permissions.</li>
                      </ul>
                    )
                  }
                  if (isIOS) {
                    return (
                      <ul className="list-disc ml-6 text-sm mb-4">
                        <li>On iOS Safari: open Settings → Safari → Camera and ensure this site is allowed.</li>
                        <li>If denied, go to Settings → Safari → Clear Website Data, then reload to re-prompt.</li>
                        <li>In some cases, enabling Request Desktop Site temporarily shows the prompt on reload.</li>
                      </ul>
                    )
                  }
                  return (
                    <ul className="list-disc ml-6 text-sm mb-4">
                      <li>Check the lock/secure icon in the address bar → site settings → Camera → Allow.</li>
                      <li>Clear site permissions and reload to re-prompt if necessary.</li>
                    </ul>
                  )
                })()}
                <div className="flex gap-2">
                  <button onClick={() => setShowPermissionHelp(false)} className="flex-1 bg-gray-300 px-4 py-2 rounded">Close</button>
                </div>
              </div>
            </div>
          )}

          {showDiagnosticsModal && diagnostics && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-2xl overflow-y-auto max-h-[80vh]">
                <h3 className="text-lg font-semibold mb-4">Diagnostics</h3>
                <pre className="text-xs bg-gray-50 p-3 rounded mb-4 overflow-auto">{JSON.stringify(diagnostics, null, 2)}</pre>
                <div className="flex gap-2">
                  <button onClick={() => { navigator.clipboard?.writeText(JSON.stringify(diagnostics)).catch(()=>{}); setShowDiagnosticsModal(false) }} className="flex-1 bg-blue-600 text-white px-4 py-2 rounded">Copy JSON</button>
                  <button onClick={() => setShowDiagnosticsModal(false)} className="flex-1 bg-gray-300 px-4 py-2 rounded">Close</button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <video
              ref={videoRef}
              className="w-full aspect-video bg-black"
              // mobile-friendly attributes
              playsInline
              muted
              autoPlay
            />
          </div>

          <div className="mt-3 flex justify-center">
            <button
              onClick={async () => {
                try {
                      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                        // prefer rear camera on mobile
                        const constraints: any = deviceId
                          ? { video: { deviceId: { exact: deviceId }, facingMode: { ideal: 'environment' } } }
                          : { video: { facingMode: { ideal: 'environment' } } }

                        const s = await navigator.mediaDevices.getUserMedia(constraints)
                        // attach briefly to prompt permission; then stop
                        if (videoRef.current) {
                          try {
                            videoRef.current.playsInline = true
                            videoRef.current.muted = true
                            videoRef.current.autoplay = true
                            videoRef.current.srcObject = s
                          } catch (e) {
                            console.warn('Could not set video attributes on ref', e)
                          }
                        }
                        s.getTracks().forEach((t) => t.stop())
                        setCameraAllowed(true)
                        setPermissionDenied(false)
                        setMessage({ text: 'Camera permission requested. Starting scanner...', type: 'success' })
                        // auto-start scanning now that permission was granted (respect user preference)
                        if (autoStart) {
                          try {
                            await startScanning()
                          } catch (e) {
                            console.warn('Auto-start scanning failed', e)
                          }
                        }
                        // re-enumerate devices after permission
                        try { const list = await navigator.mediaDevices.enumerateDevices(); setDevices(list.filter((d:any)=>d.kind==='videoinput')) } catch(e){}
                      }
                } catch (err) {
                  console.error('Camera permission failed', err)
                      setPermissionDenied(true)
                      setMessage({ text: 'Camera permission failed or was denied.', type: 'error' })
                }
              }}
              className="px-3 py-1 bg-gray-100 rounded"
            >
              Allow Camera (mobile)
            </button>
                <label className="ml-4 inline-flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={autoStart}
                    onChange={(e) => {
                      const v = e.target.checked
                      setAutoStart(v)
                      try { if (typeof window !== 'undefined') window.localStorage.setItem('scan.autoStart', String(v)) } catch (e) {}
                    }}
                    className="mr-2"
                  />
                  Auto-start on permission
                </label>
            <button
              title="Tap to prompt camera permission — prefers rear camera."
              aria-label="Camera help"
              className="ml-3 text-xs text-gray-500"
            >
              ⓘ
            </button>
          </div>

          <div className="mt-6 flex gap-4 justify-center">
            {!scanning ? (
              <button
                onClick={startScanning}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
                disabled={!events.length || (!cameraAllowed && hasGetUserMediaCompat)}
              >
                {events.length ? 'Start Scanning' : 'No events available'}
              </button>
            ) : (
              <button
                onClick={stopScanning}
                className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 font-medium"
              >
                Stop Scanning
              </button>
            )}
            <button onClick={handleCapture} className="ml-2 px-4 py-3 bg-gray-100 rounded">Capture Photo</button>
            <button onClick={() => { setNotFoundCount(0); setToast(null); switchCamera() }} className="ml-2 px-4 py-3 bg-yellow-100 rounded">Switch Camera</button>
          </div>

          {/* Session selector */}
          <div className="mt-4 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Session:</label>
              <button
                onClick={() => setScanMode('auto')}
                className={`px-3 py-1 rounded ${scanMode === 'auto' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                Auto
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  setSessionType('morning')
                  setScanMode('in')
                  try { if (!scanning) await startScanning() } catch (e) { console.warn('startScanning failed', e) }
                }}
                className={`px-4 py-2 rounded ${sessionType === 'morning' && scanMode === 'in' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                Morning Time In
              </button>

              <button
                onClick={async () => {
                  setSessionType('morning')
                  setScanMode('out')
                  try { if (!scanning) await startScanning() } catch (e) { console.warn('startScanning failed', e) }
                }}
                className={`px-4 py-2 rounded ${sessionType === 'morning' && scanMode === 'out' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                Morning Time Out
              </button>

              <button
                onClick={async () => {
                  setSessionType('afternoon')
                  setScanMode('in')
                  try { if (!scanning) await startScanning() } catch (e) { console.warn('startScanning failed', e) }
                }}
                className={`px-4 py-2 rounded ${sessionType === 'afternoon' && scanMode === 'in' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                Afternoon Time In
              </button>

              <button
                onClick={async () => {
                  setSessionType('afternoon')
                  setScanMode('out')
                  try { if (!scanning) await startScanning() } catch (e) { console.warn('startScanning failed', e) }
                }}
                className={`px-4 py-2 rounded ${sessionType === 'afternoon' && scanMode === 'out' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                Afternoon Time Out
              </button>
            </div>
          </div>

          {message && (
            <div className={`mt-6 p-4 rounded-lg text-center ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {message.text}
            </div>
          )}
          {toast && (
            <div className="fixed bottom-6 right-6 bg-white shadow-md rounded-lg p-3 flex items-center gap-3">
              <div className="text-sm">{toast.text}</div>
              {toast.action && (
                <button onClick={toast.action} className="ml-2 px-3 py-1 bg-blue-600 text-white rounded text-sm">{toast.actionLabel || 'Action'}</button>
              )}
              <button onClick={() => setToast(null)} className="ml-2 text-xs text-gray-500">Dismiss</button>
            </div>
          )}

          {scannedStudent && (
            <div className="mt-6 bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Last Scanned Student</h3>
              <div className="flex items-center gap-4">
                {scannedStudent.photo ? (
                  <img src={scannedStudent.photo} alt={scannedStudent.name} className="w-20 h-20 rounded-full object-cover" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-3xl">
                    {scannedStudent.name.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="text-xl font-medium">{scannedStudent.name}</p>
                  <p className="text-gray-600 mb-2">{scannedAttendance?.status ?? '—'}</p>
                  <div className="text-sm text-gray-600">
                    <p><span className="font-medium">Time In:</span> {scannedAttendance?.scannedAt ? new Date(scannedAttendance.scannedAt).toLocaleString() : '—'}</p>
                    <p><span className="font-medium">Time Out:</span> {scannedAttendance?.timeOut ? new Date(scannedAttendance.timeOut).toLocaleString() : 'Not available yet'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {confirming && confirmStudent && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold mb-4">{confirmAction === 'out' ? 'Confirm Time Out' : 'Confirm Time In'}</h3>
                <p className="mb-4">{confirmAction === 'out' ? `Record time-out for ` : `Record time-in for `}<strong>{confirmStudent.name}</strong>?</p>
                <div className="flex gap-2">
                  <button onClick={() => confirmTimeOut(false)} className="flex-1 bg-gray-300 px-4 py-2 rounded">Cancel</button>
                  <button onClick={() => confirmTimeOut(true)} className={`flex-1 px-4 py-2 rounded ${confirmAction === 'out' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>{confirmAction === 'out' ? 'Confirm Time Out' : 'Confirm Time In'}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
