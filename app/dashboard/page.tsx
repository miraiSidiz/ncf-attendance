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
  course?: string
  yearLevel?: string
  section?: string
}

interface Event {
  id: string
  title: string
  description?: string
  startDate: string
  endDate: string
}

interface Attendance {
  id: string
  studentId: string
  eventId: string
  status: 'PRESENT' | 'LATE' | 'ABSENT'
  student: Student
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events')
      const data = await res.json()
      setEvents(data)
      if (data.length > 0) {
        setSelectedEventId(data[0].id)
      }
    } catch (error) {
      console.error(error)
    }
  }

  const fetchStudents = async () => {
    try {
      const res = await fetch('/api/students')
      const data = await res.json()
      setStudents(data)
    } catch (error) {
      console.error(error)
    }
  }

  const fetchAttendances = async (eventId: string) => {
    if (!eventId) return
    try {
      const res = await fetch(`/api/attendance?eventId=${eventId}`)
      const data = await res.json()
      setAttendances(data)
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    if (session) {
      Promise.all([fetchEvents(), fetchStudents()]).then(() => {
        setLoading(false)
      })
    }
  }, [session])

  useEffect(() => {
    if (selectedEventId) {
      fetchAttendances(selectedEventId)
    }
  }, [selectedEventId])

  const getActiveEvent = () => {
    const now = new Date()
    return events.find(event => {
      const start = new Date(event.startDate)
      const end = new Date(event.endDate)
      return now >= start && now <= end
    })
  }

  const getAbsentAndLateStudents = () => {
    if (!selectedEventId) return { late: [], absent: [] }

    const recordedStudentIds = new Set(attendances.map(a => a.studentId))
    const lateStudents = attendances.filter(a => a.status === 'LATE').map(a => a.student)
    const absentStudents = students.filter(s => !recordedStudentIds.has(s.id))

    // Group absentees by course / yearLevel / section
    const groups: Record<string, { course?: string; yearLevel?: string; section?: string; students: Student[] }> = {}
    absentStudents.forEach((s) => {
      const course = s.course || 'Unassigned'
      const yearLevel = s.yearLevel || 'Unassigned'
      const section = s.section || 'Unassigned'
      const key = `${course}||${yearLevel}||${section}`
      if (!groups[key]) {
        groups[key] = { course, yearLevel, section, students: [] }
      }
      groups[key].students.push(s)
    })

    const absentGrouped = Object.values(groups)

    return { late: lateStudents, absent: absentGrouped }
  }

  const { late, absent } = getAbsentAndLateStudents()
  const activeEvent = getActiveEvent()

  if (status === 'loading' || loading) {
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
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

        {/* Active Event Banner */}
        {activeEvent && (
          <div className="mb-6 p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-2">Active Event</h2>
            <h3 className="text-xl font-semibold">{activeEvent.title}</h3>
            {activeEvent.description && <p className="text-blue-100">{activeEvent.description}</p>}
          </div>
        )}

        {/* Event Filter */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Event</label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select an event...</option>
            {events.map(event => (
              <option key={event.id} value={event.id}>
                {event.title} ({new Date(event.startDate).toLocaleDateString()})
              </option>
            ))}
          </select>
        </div>

        {selectedEventId && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Late Students */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-bold text-orange-600 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
                Late Students ({late.length})
              </h3>
              {late.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No late students</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {late.map(student => (
                    <div key={student.id} className="flex items-center gap-4 p-3 bg-orange-50 rounded-lg">
                      {student.photo ? (
                        <img src={student.photo} alt={student.name} className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-orange-200 flex items-center justify-center text-orange-700 font-bold">
                          {student.name.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">{student.name}</p>
                        <p className="text-sm text-gray-600">ID: {student.studentId}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Absent Students grouped by Course / Year / Section */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-bold text-red-600 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                Absent Students ({absent.reduce((sum, g) => sum + g.students.length, 0)})
              </h3>
              {absent.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No absent students</p>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {absent.map((group, idx) => (
                    <div key={idx} className="border border-red-100 rounded-md p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-semibold text-gray-800">{group.course} • {group.yearLevel} • {group.section}</p>
                          <p className="text-sm text-gray-600">Absent: {group.students.length}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {group.students.slice(0, 20).map(student => (
                          <div key={student.id} className="flex items-center gap-3 p-2 bg-red-50 rounded">
                            {student.photo ? (
                              <img src={student.photo} alt={student.name} className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center text-red-700 font-bold">
                                {student.name.charAt(0)}
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-800">{student.name}</p>
                              <p className="text-xs text-gray-600">{student.studentId}</p>
                            </div>
                          </div>
                        ))}
                        {group.students.length > 20 && (
                          <p className="text-xs text-gray-500">And {group.students.length - 20} more...</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!selectedEventId && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Please select an event to view attendance</p>
          </div>
        )}
      </main>
    </div>
  )
}
