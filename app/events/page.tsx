'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { useSession } from 'next-auth/react'

interface Event {
  id: string
  title: string
  description?: string
  startDate: string
  endDate: string
  createdAt: string
  active?: boolean
}

export default function EventsPage() {
  const { data: session, status } = useSession()
  const [events, setEvents] = useState<Event[]>([])
  const [showModal, setShowModal] = useState(false)
  const [deleteCandidate, setDeleteCandidate] = useState<Event | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [formData, setFormData] = useState({ title: '', description: '', startDate: '', endDate: '' })
  const [editingId, setEditingId] = useState<string | null>(null)
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
    setFetchLoading(true)
    try {
      const res = await fetch('/api/events')
      const data = await res.json()
      setEvents(data)
    } catch (error) {
      console.error(error)
    } finally {
      setFetchLoading(false)
    }
  }

  useEffect(() => {
    if (session) {
      fetchEvents()
    }
  }, [session])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFetchLoading(true)
    try {
      let res: Response
      if (editingId) {
        res = await fetch(`/api/events?id=${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        })
      } else {
        res = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        })
      }
      if (res.ok) {
        setFormData({ title: '', description: '', startDate: '', endDate: '' })
        setShowModal(false)
        setEditingId(null)
        fetchEvents()
      }
    } catch (error) {
      console.error(error)
    } finally {
      setFetchLoading(false)
    }
  }

  const handleEdit = (event: Event) => {
    setFormData({
      title: event.title,
      description: event.description || '',
      startDate: event.startDate.slice(0, 16),
      endDate: event.endDate.slice(0, 16)
    })
    setEditingId(event.id)
    setShowModal(true)
  }

  const toggleActive = async (id: string, current: boolean | undefined) => {
    try {
      setFetchLoading(true)
      const res = await fetch(`/api/events?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !current })
      })
      if (res.ok) {
        fetchEvents()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setFetchLoading(false)
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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Events</h1>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Add Event
          </button>
        </div>
        {fetchLoading && !events.length ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {events.map((event) => {
                  const now = new Date()
                  const isOngoing = new Date(event.startDate) <= now && now <= new Date(event.endDate)
                  const cannotDelete = Boolean(event.active) && isOngoing
                  return (
                    <tr key={event.id}>
                      <td className="px-6 py-4 whitespace-nowrap">{event.title}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatDate(event.startDate)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatDate(event.endDate)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${event.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {event.active ? (isOngoing ? 'Active · Ongoing' : 'Active') : 'Inactive'}
                        </span>
                        {!event.active && (
                          <div className="text-xs text-gray-500">(hidden from scan)</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap space-x-2">
                        <button onClick={() => handleEdit(event)} className="text-yellow-600 hover:text-yellow-900">Edit</button>
                        <button onClick={() => toggleActive(event.id, event.active)} className="text-blue-600 hover:text-blue-900">{event.active ? 'Deactivate' : 'Activate'}</button>
                        <button
                          onClick={() => {
                            if (cannotDelete) {
                              alert('Cannot delete an active event that is currently ongoing.')
                              return
                            }
                            setDeleteCandidate(event)
                            setShowDeleteModal(true)
                          }}
                          className={`text-red-600 hover:text-red-900 ${cannotDelete ? 'opacity-50 cursor-not-allowed' : ''}`}
                          disabled={cannotDelete}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Event</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date & Time</label>
                <input
                  type="datetime-local"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date & Time</label>
                <input
                  type="datetime-local"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fetchLoading}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {fetchLoading ? 'Adding...' : 'Add Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && deleteCandidate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Delete Event</h2>
            <p className="mb-4">Are you sure you want to delete the event <strong>{deleteCandidate.title}</strong>? This action cannot be undone.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowDeleteModal(false); setDeleteCandidate(null) }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setFetchLoading(true)
                    const res = await fetch(`/api/events?id=${deleteCandidate.id}`, { method: 'DELETE' })
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}))
                      alert(data?.error || 'Failed to delete event')
                    } else {
                      setShowDeleteModal(false)
                      setDeleteCandidate(null)
                      fetchEvents()
                    }
                  } catch (err) {
                    console.error(err)
                    alert('Error deleting event')
                  } finally {
                    setFetchLoading(false)
                  }
                }}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
              >
                Delete Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
