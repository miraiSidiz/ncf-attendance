'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { useSession } from 'next-auth/react'
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library'
import { Settings, RefreshCw, Activity, Upload, Camera, CheckCircle, AlertCircle, List } from 'lucide-react'

interface Event {
  id: string
  title: string
  endDate?: string
}

interface Student {
  id: string
  name: string
  photo?: string
  studentId: string
  course?: string
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

interface ScanHistoryEntry {
  id: number
  studentName: string
  studentId: string
  action: string
  status: 'success' | 'error'
  message: string
  time: string
}

export default function ScanPage() {
  const { data: session, status } = useSession()
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState<string>('')
  const [scanning, setScanning] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
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
  const [showSettings, setShowSettings] = useState<boolean>(false)
  const [deviceProbeResults, setDeviceProbeResults] = useState<Record<string, string>>({})
  const [notFoundCount, setNotFoundCount] = useState(0)
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([])

  const videoRef = useRef<HTMLVideoElement>(null)
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null)
  const router = useRouter()

  const scanModeRef = useRef(scanMode)
  const sessionTypeRef = useRef(sessionType)
  const selectedEventRef = useRef(selectedEvent)
  const isProcessingRef = useRef(false)
  const lastScannedQrRef = useRef<{ code: string; time: number } | null>(null)

  useEffect(() => { scanModeRef.current = scanMode }, [scanMode])
  useEffect(() => { sessionTypeRef.current = sessionType }, [sessionType])
  useEffect(() => { selectedEventRef.current = selectedEvent }, [selectedEvent])

  // Play audio beep/buzz based on success/error
  const playBeep = (type: 'success' | 'error') => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) return
      const ctx = new AudioContextClass()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      if (type === 'success') {
        osc.type = 'sine'
        osc.frequency.setValueAtTime(880, ctx.currentTime) // High beep
        gain.gain.setValueAtTime(0.1, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
        osc.start()
        osc.stop(ctx.currentTime + 0.15)
      } else {
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(150, ctx.currentTime) // Low buzz
        gain.gain.setValueAtTime(0.15, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
        osc.start()
        osc.stop(ctx.currentTime + 0.35)
      }
    } catch (e) {
      console.warn('Audio feedback failed', e)
    }
  }

  // Auto-detect session based on time of day
  useEffect(() => {
    const now = new Date()
    const afterNoon = new Date(now)
    afterNoon.setHours(13, 0, 0, 0)
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
      if (Array.isArray(data)) {
        setEvents(data)
        if (data.length > 0 && !selectedEvent) {
          setSelectedEvent(data[0].id)
        }
      }
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    if (session) {
      fetchEvents()
      codeReaderRef.current = new BrowserMultiFormatReader()
      
      const hasModern = typeof navigator !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
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
          }
        } catch (err) {
          console.error('Could not polyfill legacy getUserMedia', err)
        }
      }

      setHasGetUserMediaCompat(!!(typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia))

      try {
        if (typeof window !== 'undefined') {
          const stored = window.localStorage.getItem('scan.autoStart')
          if (stored !== null) setAutoStart(stored === 'true')
        }
      } catch (e) {}

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

  // Show a warning toast on sustained failures to decode
  useEffect(() => {
    if (notFoundCount >= 15) {
      setMessage({ text: 'Ensure the QR code is centered and well lit.', type: 'error' })
    }
  }, [notFoundCount])

  const handleScan = async (qrCode: string) => {
    // 1. Prevent overlapping scans
    if (isProcessingRef.current) return

    // 2. Prevent scanning the same code multiple times in a row within 3 seconds (debounce/cooldown)
    const nowTime = Date.now()
    if (
      lastScannedQrRef.current &&
      lastScannedQrRef.current.code === qrCode &&
      nowTime - lastScannedQrRef.current.time < 3000
    ) {
      return
    }

    isProcessingRef.current = true
    setIsProcessing(true)
    lastScannedQrRef.current = { code: qrCode, time: nowTime }

    const currentScanMode = scanModeRef.current
    const currentSessionType = sessionTypeRef.current
    const currentSelectedEvent = selectedEventRef.current

    try {
      // Trigger short vibration immediately on camera decode
      try { if (typeof navigator !== 'undefined' && (navigator as any).vibrate) (navigator as any).vibrate(40) } catch (e) {}

      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrCode,
          eventId: currentSelectedEvent,
          action: currentScanMode !== 'auto' ? currentScanMode : undefined,
          sessionType: currentSessionType
        })
      })

      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

      if (res.ok) {
        const data = await res.json()
        setScannedStudent(data.student)
        setScannedAttendance(data.attendance)

        const acted = data.attendance?.timeOut ? 'Time-out' : 'Time-in'
        const sessionLabel = data.attendance?.sessionType === 'morning' ? 'AM' : 'PM'
        const successLabel = `${acted} (${sessionLabel})`
        setMessage({ text: `${successLabel} recorded for ${data.student.name}`, type: 'success' })
        
        // Add to live scanner history ticker
        setScanHistory(prev => [
          {
            id: Date.now(),
            studentName: data.student.name,
            studentId: data.student.studentId,
            action: successLabel,
            status: 'success',
            message: 'Recorded successfully',
            time: timestamp
          },
          ...prev.slice(0, 4)
        ])

        playBeep('success')
        try { if (typeof navigator !== 'undefined' && (navigator as any).vibrate) (navigator as any).vibrate([60, 50, 60]) } catch (e) {}
      } else {
        const data = await res.json()
        setMessage({ text: data.error || 'Failed to record attendance', type: 'error' })
        
        // Add failure to live scanner history ticker
        setScanHistory(prev => [
          {
            id: Date.now(),
            studentName: 'Invalid / Error Scan',
            studentId: qrCode.slice(0, 15) + (qrCode.length > 15 ? '...' : ''),
            action: `${currentScanMode === 'auto' ? 'Auto' : currentScanMode.toUpperCase()} (${currentSessionType === 'morning' ? 'AM' : 'PM'})`,
            status: 'error',
            message: data.error || 'Failed to record',
            time: timestamp
          },
          ...prev.slice(0, 4)
        ])

        playBeep('error')
        try { if (typeof navigator !== 'undefined' && (navigator as any).vibrate) (navigator as any).vibrate(250) } catch (e) {}
      }
    } catch (error) {
      console.error(error)
      setMessage({ text: 'Network error. Failed to record attendance.', type: 'error' })
      
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      setScanHistory(prev => [
        {
          id: Date.now(),
          studentName: 'Network Error',
          studentId: '—',
          action: 'API Call',
          status: 'error',
          message: 'Connection failed',
          time: timestamp
        },
        ...prev.slice(0, 4)
      ])
      
      playBeep('error')
    } finally {
      // Release scanner processing lock after 1.2 seconds, camera keeps running
      setTimeout(() => {
        isProcessingRef.current = false
        setIsProcessing(false)
      }, 1200)
    }
  }

  const handleFileUpload = async (file: File | null) => {
    if (!file || !codeReaderRef.current) return
    try {
      setMessage(null)
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.src = url
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej })
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

  const startScanning = async () => {
    if (!selectedEvent) {
      setMessage({ text: 'Please select an event first', type: 'error' })
      return
    }

    if (!codeReaderRef.current || !videoRef.current) return

    if (!hasGetUserMediaCompat) {
      setMessage({ text: 'Camera API not available in this browser. You can upload a photo of the QR code instead.', type: 'error' })
      setScanning(false)
      return
    }

    const tryDevicesAndStart = async () => {
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
              try {
                const hiResConstraints: any = { video: { deviceId: { exact: dev.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: { ideal: 'environment' } } }
                const tmpStream = await navigator.mediaDevices.getUserMedia(hiResConstraints)
                if (videoRef.current) videoRef.current.srcObject = tmpStream
                tmpStream.getTracks().forEach((t) => t.stop())
              } catch (e) {}

              codeReaderRef.current.decodeFromVideoDevice(dev.deviceId, videoRef.current, (result, err) => {
                if (result) {
                  setNotFoundCount(0)
                  handleScan(result.getText())
                }
                if (err) {
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
      if (!deviceId) {
        const started = await tryDevicesAndStart()
        if (!started) {
          setMessage({ text: 'No available camera found. Check permissions or upload a QR image.', type: 'error' })
          setScanning(false)
        }
        return
      }

      try {
        const constraints: any = deviceId
          ? { video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: { ideal: 'environment' } } }
          : { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: { ideal: 'environment' } } }
        const warm = await navigator.mediaDevices.getUserMedia(constraints)
        if (videoRef.current) videoRef.current.srcObject = warm
        warm.getTracks().forEach((t) => t.stop())
      } catch (e) {}

      await codeReaderRef.current.decodeFromVideoDevice(deviceId ?? null, videoRef.current, async (result, err) => {
        if (result) {
          setNotFoundCount(0)
          handleScan(result.getText())
        }
        if (err) {
          const name = (err && err.name) || ''
          if ((err as any)?.name === 'NotFoundException' || err instanceof NotFoundException) {
            setNotFoundCount(c => c + 1)
            return
          }
          console.error(err)
          if (name === 'NotFoundError' || name === 'NotReadableError') {
            const fallbackStarted = await tryDevicesAndStart()
            if (!fallbackStarted) {
              setMessage({ text: 'Camera not found or unavailable. Check camera device and permissions.', type: 'error' })
              setScanning(false)
            }
            return
          } else if (name === 'NotAllowedError' || name === 'SecurityError') {
            setMessage({ text: 'Camera access denied. Allow camera permission in your browser.', type: 'error' })
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
        setMessage({ text: 'Failed to start camera. Camera API appears blocked. Check browser settings.', type: 'error' })
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

  const switchCamera = async () => {
    if (!devices || devices.length <= 1) return
    const idx = devices.findIndex(d => d.deviceId === deviceId)
    const next = devices[(idx + 1) % devices.length]
    setDeviceId(next.deviceId)
    setNotFoundCount(0)
    if (scanning) {
      stopScanning()
      setTimeout(() => startScanning().catch(() => {}), 300)
    }
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

  const probeDevices = async () => {
    const results: Record<string, string> = {}
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

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!session) return null

  const activeEventTitle = events.find(e => e.id === selectedEvent)?.title || 'No Event Selected'

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-800">
      <style>{`
        @keyframes scanLine {
          0% { top: 4%; }
          50% { top: 96%; }
          100% { top: 4%; }
        }
        .laser-sweep {
          animation: scanLine 2.5s linear infinite;
        }
      `}</style>

      <Sidebar />

      <main className="flex-1 p-4 md:p-8 md:ml-64 pt-20 md:pt-8 min-h-screen flex flex-col items-center">
        <div className="w-full max-w-lg flex flex-col gap-6">
          
          {/* Main Title Header */}
          <div className="flex justify-between items-center border-b border-gray-200 pb-3">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Scan Attendance</h1>
              <p className="text-sm text-gray-500 mt-1">Event: <span className="font-semibold text-blue-600">{activeEventTitle}</span></p>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors border ${
                showSettings 
                  ? 'bg-blue-50 border-blue-200 text-blue-600' 
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
              title="Toggle settings panel"
            >
              <Settings size={20} />
            </button>
          </div>

          {/* Collapsible settings panel */}
          {showSettings && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col gap-4 animate-fadeIn">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2 border-b pb-2">
                <Settings size={16} /> Configuration & Advanced
              </h3>

              {/* Event Selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Select Event</label>
                <select
                  value={selectedEvent}
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
                  disabled={scanning}
                >
                  <option value="">-- Select an event --</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>{event.title}</option>
                  ))}
                </select>
              </div>

              {/* Camera Selector */}
              {devices.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Select Camera</label>
                  <select
                    value={deviceId ?? ''}
                    onChange={(e) => setDeviceId(e.target.value || null)}
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
                    disabled={scanning}
                  >
                    {devices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 5)}`}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Upload fallback */}
              {!hasGetUserMediaCompat && (
                <div className="border border-dashed border-gray-300 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-600 mb-2">Camera API not supported. Upload a QR photo instead:</p>
                  <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 text-xs font-semibold rounded-lg hover:bg-blue-100 transition-colors">
                    <Upload size={14} /> Upload QR Image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e.target.files ? e.target.files[0] : null)}
                      className="hidden"
                      disabled={scanning}
                    />
                  </label>
                </div>
              )}

              {/* Advanced Diagnostics */}
              <div className="border-t pt-3 flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>Detected cameras: {devices.length}</span>
                  <button 
                    onClick={probeDevices} 
                    className="text-blue-600 hover:underline font-semibold"
                  >
                    Probe Devices
                  </button>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={async () => { const d = await gatherDiagnostics(); setDiagnostics(d); setShowDiagnosticsModal(true) }} 
                    className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1"
                  >
                    <Activity size={12} /> Run Diagnostics
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Session Mode selector (Large mobile friendly buttons) */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Attendance Mode</span>
            
            <div className="grid grid-cols-5 bg-gray-200/70 p-1 rounded-xl gap-1">
              <button
                onClick={() => setScanMode('auto')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  scanMode === 'auto'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-700 hover:bg-gray-300/40'
                }`}
              >
                Auto
              </button>
              
              <button
                onClick={() => { setSessionType('morning'); setScanMode('in') }}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  sessionType === 'morning' && scanMode === 'in'
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'text-gray-700 hover:bg-gray-300/40'
                }`}
              >
                AM In
              </button>

              <button
                onClick={() => { setSessionType('morning'); setScanMode('out') }}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  sessionType === 'morning' && scanMode === 'out'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-gray-700 hover:bg-gray-300/40'
                }`}
              >
                AM Out
              </button>

              <button
                onClick={() => { setSessionType('afternoon'); setScanMode('in') }}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  sessionType === 'afternoon' && scanMode === 'in'
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'text-gray-700 hover:bg-gray-300/40'
                }`}
              >
                PM In
              </button>

              <button
                onClick={() => { setSessionType('afternoon'); setScanMode('out') }}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  sessionType === 'afternoon' && scanMode === 'out'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-gray-700 hover:bg-gray-300/40'
                }`}
              >
                PM Out
              </button>
            </div>
            
            <p className="text-center text-xs text-gray-500 font-medium">
              Currently setting: <span className="font-bold text-gray-800 uppercase">
                {scanMode === 'auto' ? 'Auto-detect In/Out' : `${sessionType} time ${scanMode}`}
              </span>
            </p>
          </div>

          {/* Camera Viewport Area */}
          <div className="flex flex-col items-center">
            
            <div className="relative w-full max-w-sm aspect-square overflow-hidden rounded-2xl border-4 border-gray-900 bg-black shadow-xl">
              
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
                autoPlay
              />

              {/* Scanning Target Crosshairs */}
              <div className="absolute inset-0 pointer-events-none border border-white/10 flex items-center justify-center">
                
                {/* Neon sweep line */}
                {scanning && !isProcessing && (
                  <div className="absolute inset-x-4 h-0.5 bg-green-500 opacity-80 shadow-[0_0_8px_#22c55e] laser-sweep" />
                )}

                {/* Grid indicator brackets */}
                <div className="absolute top-6 left-6 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
                <div className="absolute top-6 right-6 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
                <div className="absolute bottom-6 left-6 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
                <div className="absolute bottom-6 right-6 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />
                
                {/* Center scan zone guide */}
                <div className="w-48 h-48 border border-dashed border-white/20 rounded-xl" />
              </div>

              {/* Processing Loading Spinner Over Video */}
              {isProcessing && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                  <span className="text-white text-xs font-semibold tracking-wider uppercase animate-pulse">Recording...</span>
                </div>
              )}

              {/* Camera Offline State */}
              {!scanning && (
                <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center text-center p-6 gap-3">
                  <div className="p-3 bg-gray-800 rounded-full text-gray-500">
                    <Camera size={36} />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm">Scanner Offline</h4>
                    <p className="text-gray-400 text-xs mt-1 max-w-[200px] mx-auto">Select an event and tap start scanning to open camera.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Toggle Controls */}
            <div className="mt-4 w-full max-w-sm flex gap-3">
              {!scanning ? (
                <button
                  onClick={startScanning}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                  disabled={!events.length}
                >
                  <Camera size={18} /> Start Scanner
                </button>
              ) : (
                <button
                  onClick={stopScanning}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 active:scale-98 text-white font-bold rounded-xl shadow-md transition-all"
                >
                  Stop Scanner
                </button>
              )}

              {devices.length > 1 && scanning && (
                <button 
                  onClick={switchCamera} 
                  className="px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl flex items-center justify-center transition-colors"
                  title="Switch Camera"
                >
                  <RefreshCw size={18} />
                </button>
              )}
            </div>

            {/* Quick mobile permission trigger */}
            {!cameraAllowed && hasGetUserMediaCompat && (
              <button
                onClick={async () => {
                  try {
                    const constraints = { video: { facingMode: { ideal: 'environment' } } }
                    const s = await navigator.mediaDevices.getUserMedia(constraints)
                    s.getTracks().forEach((t) => t.stop())
                    setCameraAllowed(true)
                    setPermissionDenied(false)
                    startScanning()
                  } catch (err) {
                    setPermissionDenied(true)
                    setMessage({ text: 'Camera access permission denied.', type: 'error' })
                  }
                }}
                className="mt-3 text-xs text-blue-600 font-bold hover:underline"
              >
                Force Camera Permission Prompt
              </button>
            )}
          </div>

          {/* Feedback messages */}
          {message && (
            <div className={`p-4 rounded-xl border flex items-start gap-3 transition-all animate-fadeIn ${
              message.type === 'success' 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <div className="mt-0.5">
                {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold tracking-wide">{message.text}</p>
              </div>
            </div>
          )}

          {/* Last Scanned Student Card */}
          {scannedStudent && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col gap-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Last Scanned Student</h3>
                <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
                  scannedAttendance?.status === 'PRESENT' 
                    ? 'bg-green-100 text-green-800' 
                    : scannedAttendance?.status === 'LATE'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {scannedAttendance?.status}
                </span>
              </div>
              
              <div className="flex items-center gap-4">
                {scannedStudent.photo ? (
                  <img 
                    src={scannedStudent.photo} 
                    alt={scannedStudent.name} 
                    className="w-16 h-16 rounded-full object-cover ring-2 ring-gray-100 shadow-inner" 
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-2xl shadow-inner border border-blue-200">
                    {scannedStudent.name.charAt(0)}
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-gray-900 truncate text-base">{scannedStudent.name}</h4>
                  <p className="text-xs text-gray-500 font-medium">ID: {scannedStudent.studentId} • Course: {scannedStudent.course || 'Unassigned'}</p>
                  
                  <div className="mt-2 text-xs text-gray-600 flex flex-col gap-0.5">
                    <p>
                      <span className="font-semibold text-gray-700">Time In:</span>{' '}
                      {scannedAttendance?.scannedAt ? new Date(scannedAttendance.scannedAt).toLocaleTimeString() : '—'}
                    </p>
                    <p>
                      <span className="font-semibold text-gray-700">Time Out:</span>{' '}
                      {scannedAttendance?.timeOut ? new Date(scannedAttendance.timeOut).toLocaleTimeString() : 'Not timed out yet'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Scan History Ticker (Recent Scans) */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col gap-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
              <List size={14} /> Recent Scans (Last 5)
            </h3>
            {scanHistory.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No scans recorded in this session yet.</p>
            ) : (
              <div className="flex flex-col gap-2 divide-y divide-gray-100">
                {scanHistory.map((h) => (
                  <div key={h.id} className="pt-2 first:pt-0 flex items-center justify-between text-xs gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-800 truncate">
                        {h.studentName} <span className="text-[10px] text-gray-400 font-normal">({h.studentId})</span>
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {h.action} • {h.time}
                      </p>
                    </div>
                    <div className="ml-3 flex flex-col items-end shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                        h.status === 'success' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {h.status === 'success' ? 'SUCCESS' : 'FAILED'}
                      </span>
                      {h.status === 'error' && (
                        <span className="text-[9px] text-red-500 font-medium mt-0.5 text-right max-w-[150px] truncate" title={h.message}>
                          {h.message}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Diagnostics Modal */}
          {showDiagnosticsModal && diagnostics && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]">
                <h3 className="text-lg font-bold border-b pb-2 mb-3">System Diagnostics</h3>
                <pre className="text-[10px] font-mono bg-gray-50 p-3 rounded-lg overflow-auto flex-1">{JSON.stringify(diagnostics, null, 2)}</pre>
                <div className="flex gap-2 mt-4">
                  <button 
                    onClick={() => { navigator.clipboard?.writeText(JSON.stringify(diagnostics)).catch(()=>{}); alert('Copied!') }} 
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm"
                  >
                    Copy JSON
                  </button>
                  <button 
                    onClick={() => setShowDiagnosticsModal(false)} 
                    className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
