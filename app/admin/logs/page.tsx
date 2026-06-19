'use client'

import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'

interface LogItem {
  id: string
  action: string
  eventId: string
  studentId: string
  previousTimeOut?: string | null
  newTimeOut?: string | null
  createdAt: string
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<LogItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch('/api/admin/attendance-logs')
        const data = await res.json()
        setLogs(data.logs || [])
      } catch (e) {
        console.error(e)
      } finally { setLoading(false) }
    }
    fetchLogs()
  }, [])

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-64 flex-1 p-8 bg-gray-50">
        <h1 className="text-2xl font-bold mb-4">Attendance Audit Logs</h1>
        {loading ? <div>Loading...</div> : (
          <div className="bg-white rounded shadow overflow-auto">
            <table className="min-w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">When</th>
                  <th className="p-2 text-left">Action</th>
                  <th className="p-2 text-left">Student</th>
                  <th className="p-2 text-left">Event</th>
                  <th className="p-2 text-left">Prev Out</th>
                  <th className="p-2 text-left">New Out</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="p-2 text-sm text-gray-600">{new Date(l.createdAt).toLocaleString()}</td>
                    <td className="p-2">{l.action}</td>
                    <td className="p-2 text-sm">{l.studentId}</td>
                    <td className="p-2 text-sm">{l.eventId}</td>
                    <td className="p-2 text-sm">{l.previousTimeOut ? new Date(l.previousTimeOut).toLocaleString() : '—'}</td>
                    <td className="p-2 text-sm">{l.newTimeOut ? new Date(l.newTimeOut).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
