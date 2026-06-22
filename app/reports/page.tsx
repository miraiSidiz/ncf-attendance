'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { useSession } from 'next-auth/react'

interface Student {
  id: string
  name: string
  studentId: string
  photo?: string
}

interface ReportItem {
  student: Student
  morning: { id?: string; in: string | null; out: string | null; status: string }
  afternoon: { id?: string; in: string | null; out: string | null; status: string }
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EARLY_LEAVE'
}

interface Event {
  id: string
  title: string
}

export default function ReportsPage() {
  const { data: session, status } = useSession()
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState<string>('')
  const [report, setReport] = useState<ReportItem[]>([])
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [filterCourse, setFilterCourse] = useState<string>('ALL')
  const [filterYear, setFilterYear] = useState<string>('ALL')
  const [fetchLoading, setFetchLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && (session?.user as any)?.role !== 'ADMIN') {
      router.push('/dashboard')
    }
  }, [session, status, router])

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events')
      const data = await res.json()
      if (Array.isArray(data)) {
        setEvents(data)
      } else {
        console.error('Expected array of events, got:', data)
        setEvents([])
      }
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    if (session) {
      fetchEvents()
    }
  }, [session])

  const fetchReport = async () => {
    if (!selectedEvent) return

    setFetchLoading(true)
    try {
      const res = await fetch(`/api/reports?eventId=${selectedEvent}`)
      const data = await res.json()
      if (data && Array.isArray(data.report)) {
        setReport(data.report)
      } else {
        console.error('Expected array for report, got:', data)
        setReport([])
      }
    } catch (error) {
      console.error(error)
    } finally {
      setFetchLoading(false)
    }
  }

  useEffect(() => {
    if (selectedEvent) {
      fetchReport()
    }
  }, [selectedEvent])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return 'text-green-600 bg-green-100'
      case 'LATE':
        return 'text-yellow-600 bg-yellow-100'
      case 'ABSENT':
        return 'text-red-600 bg-red-100'
      case 'EARLY_LEAVE':
        return 'text-orange-600 bg-orange-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!session || (session?.user as any)?.role !== 'ADMIN') {
    return null
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-64 flex-1 p-8 bg-gray-50">
        <h1 className="text-3xl font-bold mb-6">Attendance Reports</h1>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Event</label>
          <select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="w-full max-w-md px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Select an event --</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>{event.title}</option>
            ))}
          </select>
          {selectedEvent && (
            <div className="mt-3 flex gap-2">
              <button onClick={async () => {
                if (!confirm('Are you sure you want to delete ALL attendance records for this event? This cannot be undone.')) return
                const reason = prompt('Reason for bulk deleting attendance for this event:')
                if (!reason || reason.trim().length === 0) return alert('Deletion reason is required')
                try {
                  const res = await fetch('/api/attendance', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: selectedEvent, reason }) })
                  const d = await res.json()
                  if (res.ok) {
                    alert(`Deleted ${d.deleted || 0} attendance records`)
                    fetchReport()
                  } else {
                    alert(d.error || 'Failed to bulk delete')
                  }
                } catch (e) { alert('Failed to bulk delete') }
              }} className="px-3 py-2 bg-red-600 text-white rounded">Delete All Attendance for Event</button>
            </div>
          )}
        </div>

        {fetchLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : selectedEvent && report.length > 0 ? (
          <div>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center mb-4">
              <label className="text-sm">Status:</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border rounded">
                <option value="ALL">All</option>
                <option value="PRESENT">Present</option>
                <option value="LATE">Late</option>
                <option value="ABSENT">Absent</option>
                <option value="EARLY_LEAVE">Early Leave</option>
              </select>

              <label className="text-sm">Course:</label>
              <select value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)} className="px-3 py-2 border rounded">
                <option value="ALL">All</option>
                {[...new Set(report.map(r => (r.student as any).course || ''))].filter(Boolean).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <label className="text-sm">Year:</label>
              <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="px-3 py-2 border rounded">
                <option value="ALL">All</option>
                {[...new Set(report.map(r => (r.student as any).yearLevel || ''))].filter(Boolean).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              <div className="ml-auto flex gap-2">
                <button onClick={() => {
                  // export: open printable window
                  const filtered = report
                    .filter(r => filterStatus === 'ALL' ? true : r.status === filterStatus)
                    .filter(r => filterCourse === 'ALL' ? true : (r.student as any).course === filterCourse)
                    .filter(r => filterYear === 'ALL' ? true : (r.student as any).yearLevel === filterYear)

                  const win = window.open('', '_blank')
                  if (!win) return
                  const style = `<style>table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f3f4f6}</style>`
                  let html = `<html><head><title>Report</title>${style}</head><body><h2>Attendance Report</h2><table><thead><tr><th>#</th><th>Student</th><th>Student ID</th><th>Course</th><th>Year</th><th>Morning In</th><th>Morning Out</th><th>Afternoon In</th><th>Afternoon Out</th><th>Status</th></tr></thead><tbody>`
                  filtered.forEach((r, i) => {
                    html += `<tr><td>${i+1}</td><td>${r.student.name}</td><td>${r.student.studentId || ''}</td><td>${(r.student as any).course || ''}</td><td>${(r.student as any).yearLevel || ''}</td><td>${r.morning.in ? new Date(r.morning.in).toLocaleString() : '—'}</td><td>${r.morning.out ? new Date(r.morning.out).toLocaleString() : '—'}</td><td>${r.afternoon.in ? new Date(r.afternoon.in).toLocaleString() : '—'}</td><td>${r.afternoon.out ? new Date(r.afternoon.out).toLocaleString() : '—'}</td><td>${r.status}</td></tr>`
                  })
                  html += `</tbody></table></body></html>`
                  win.document.write(html)
                  win.document.close()
                  win.print()
                }} className="px-3 py-2 bg-blue-600 text-white rounded">Export PDF</button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Student ID</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Course</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Year</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Morning In</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Morning Out</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Afternoon In</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Afternoon Out</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {report
                    .filter(r => filterStatus === 'ALL' ? true : r.status === filterStatus)
                    .filter(r => filterCourse === 'ALL' ? true : (r.student as any).course === filterCourse)
                    .filter(r => filterYear === 'ALL' ? true : (r.student as any).yearLevel === filterYear)
                    .map((item, idx) => (
                      <tr key={item.student.id}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{idx + 1}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            {item.student.photo ? (
                              <img src={item.student.photo} alt={item.student.name} className="w-8 h-8 rounded-full object-cover mr-3" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 mr-3">{item.student.name.charAt(0)}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-medium text-gray-900">{item.student.name}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{item.student.studentId}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{(item.student as any).course || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{(item.student as any).yearLevel || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {item.morning.in ? formatDate(item.morning.in) : '—'}
                          {item.morning.id && (
                            <button onClick={async () => {
                              const reason = prompt('Reason for deleting morning attendance for ' + item.student.name + '?')
                              if (!reason || reason.trim().length === 0) return alert('Deletion reason is required')
                              try {
                                const res = await fetch(`/api/attendance`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.morning.id, reason }) })
                                if (res.ok) {
                                  fetchReport()
                                } else {
                                  const d = await res.json()
                                  alert(d.error || 'Failed to delete')
                                }
                              } catch (e) { alert('Failed to delete') }
                            }} className="ml-2 text-xs text-red-600">Delete</button>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {item.morning.out ? formatDate(item.morning.out) : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {item.afternoon.in ? formatDate(item.afternoon.in) : '—'}
                          {item.afternoon.id && (
                            <button onClick={async () => {
                              const reason = prompt('Reason for deleting afternoon attendance for ' + item.student.name + '?')
                              if (!reason || reason.trim().length === 0) return alert('Deletion reason is required')
                              try {
                                const res = await fetch(`/api/attendance`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.afternoon.id, reason }) })
                                if (res.ok) {
                                  fetchReport()
                                } else {
                                  const d = await res.json()
                                  alert(d.error || 'Failed to delete')
                                }
                              } catch (e) { alert('Failed to delete') }
                            }} className="ml-2 text-xs text-red-600">Delete</button>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{item.afternoon.out ? formatDate(item.afternoon.out) : '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap"><span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>{item.status.replace('_',' ')}</span></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}
