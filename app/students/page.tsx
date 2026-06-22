'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { useSession } from 'next-auth/react'
import { QRCodeSVG } from 'qrcode.react'

interface Student {
  id: string
  name: string
  studentId: string
  photo?: string
  email?: string
  gender?: string
  course?: string
  yearLevel?: string
  section?: string
  qrCode: string
  createdAt: string
}

export default function StudentsPage() {
  const { data: session, status } = useSession()
  const [students, setStudents] = useState<Student[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [formData, setFormData] = useState({ name: '', studentId: '', photo: '', email: '', gender: '', course: '', yearLevel: '', section: '' })
  const [bulkFile, setBulkFile] = useState<File | null>(null)
  const [bulkPreview, setBulkPreview] = useState<any[]>([])
  const [fetchLoading, setFetchLoading] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [courseFilter, setCourseFilter] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && (session?.user as any)?.role !== 'ADMIN') {
      router.push('/dashboard')
    }
  }, [session, status, router])

  const fetchStudents = async () => {
    setFetchLoading(true)
    try {
      const res = await fetch('/api/students')
      const data = await res.json()
      setStudents(data)
    } catch (error) {
      console.error(error)
    } finally {
      setFetchLoading(false)
    }
  }

  useEffect(() => {
    if (session) {
      fetchStudents()
    }
  }, [session])

  const uniqueCourses = Array.from(new Set(students.map(s => s.course).filter(Boolean))) as string[]

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.studentId.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCourse = courseFilter === '' || s.course === courseFilter
    return matchesSearch && matchesCourse
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFetchLoading(true)
    try {
      if (editingStudentId) {
        const res = await fetch(`/api/students/${editingStudentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        })
        if (res.ok) {
          setFormData({ name: '', studentId: '', photo: '', email: '', gender: '', course: '', yearLevel: '', section: '' })
          setShowModal(false)
          setEditingStudentId(null)
          fetchStudents()
        }
      } else {
        const res = await fetch('/api/students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        })
        if (res.ok) {
          setFormData({ name: '', studentId: '', photo: '', email: '', gender: '', course: '', yearLevel: '', section: '' })
          setShowModal(false)
          fetchStudents()
        }
      }
    } catch (error) {
      console.error(error)
    } finally {
      setFetchLoading(false)
    }
  }

  const openEdit = (student: Student) => {
    setFormData({
      name: student.name || '',
      studentId: student.studentId || '',
      photo: student.photo || '',
      email: student.email || '',
      gender: student.gender || '',
      course: student.course || '',
      yearLevel: student.yearLevel || '',
      section: student.section || ''
    })
    setEditingStudentId(student.id)
    setShowModal(true)
  }

  const sanitizeFilename = (name: string) => {
    return name.replace(/[^a-z0-9-_\. ]/gi, '_')
  }
  const exportQRCodesZip = async () => {
    if (!filteredStudents.length) {
      alert('No students to export')
      return
    }
    try {
      const params = new URLSearchParams()
      if (courseFilter) params.append('course', courseFilter)
      if (searchQuery) params.append('search', searchQuery)
      const apiUrl = `/api/students/zip${params.toString() ? `?${params.toString()}` : ''}`
      const res = await fetch(apiUrl)
      if (!res.ok) throw new Error('Failed to generate ZIP')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `qrcodes_${new Date().toISOString().slice(0, 10)}.zip`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      alert('Failed to download ZIP.')
    }
  }

  const downloadTemplate = () => {
    const header = 'Name,Student ID,Email,Gender,Course,Year Level,Section,Photo URL\n'
    const sample = 'John Doe,S001,john@school.com,Male,BS Computer Science,1st Year,A,\nJane Smith,S002,jane@school.com,Female,BS Information Technology,2nd Year,B,'
    const csv = header + sample
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'students_template.csv'
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const exportStudentData = () => {
    if (!filteredStudents.length) {
      alert('No students to export')
      return
    }
    const header = 'Name,Student ID,Email,Gender,Course,Year Level,Section\n'
    const rows = filteredStudents.map(s => 
      `"${s.name}","${s.studentId}","${s.email || ''}","${s.gender || ''}","${s.course || ''}","${s.yearLevel || ''}","${s.section || ''}"`
    ).join('\n')
    const csv = header + rows
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `students_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const exportQRCodes = () => {
    if (!filteredStudents.length) {
      alert('No students to export')
      return
    }
    const header = 'Student Name,Student ID,QR Code\n'
    const rows = filteredStudents.map(s => 
      `"${s.name}","${s.studentId}","${s.qrCode}"`
    ).join('\n')
    const csv = header + rows
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `qrcodes_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this student?')) return
    try {
      await fetch(`/api/students/${id}`, { method: 'DELETE' })
      fetchStudents()
    } catch (error) {
      console.error(error)
    }
  }

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim())
    if (lines.length < 2) return []

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const nameIndex = headers.findIndex(h => h === 'name' || h === 'student name')
    const studentIdIndex = headers.findIndex(h => h === 'studentid' || h === 'student id' || h === 'id')
    const emailIndex = headers.findIndex(h => h === 'email')
    const genderIndex = headers.findIndex(h => h === 'gender')
    const photoIndex = headers.findIndex(h => h === 'photo' || h === 'photo url')
    const courseIndex = headers.findIndex(h => h === 'course')
    const yearLevelIndex = headers.findIndex(h => h === 'yearlevel' || h === 'year level' || h === 'year')
    const sectionIndex = headers.findIndex(h => h === 'section')

    if (nameIndex === -1 || studentIdIndex === -1) {
      alert('CSV must have at least "Name" and "Student ID" columns')
      return []
    }

    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim())
      return {
        name: values[nameIndex],
        studentId: values[studentIdIndex],
        email: emailIndex !== -1 ? values[emailIndex] : '',
        gender: genderIndex !== -1 ? values[genderIndex] : '',
        photo: photoIndex !== -1 ? values[photoIndex] : '',
        course: courseIndex !== -1 ? values[courseIndex] : '',
        yearLevel: yearLevelIndex !== -1 ? values[yearLevelIndex] : '',
        section: sectionIndex !== -1 ? values[sectionIndex] : ''
      }
    }).filter(s => s.name && s.studentId)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setBulkFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        const parsed = parseCSV(text)
        setBulkPreview(parsed)
      }
      reader.readAsText(file)
    }
  }

  const handleBulkUpload = async () => {
    if (!bulkPreview.length) return
    setBulkLoading(true)
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bulkPreview)
      })
      if (res.ok) {
        setShowBulkModal(false)
        setBulkFile(null)
        setBulkPreview([])
        fetchStudents()
      }
    } catch (error) {
      console.error(error)
    } finally {
      setBulkLoading(false)
    }
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
          <h1 className="text-3xl font-bold">Students</h1>
          <div className="flex gap-2">
            <button
              onClick={downloadTemplate}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
              title="Download CSV template for bulk import"
            >
              Download Template
            </button>
            <button
              onClick={exportStudentData}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700"
              title="Export all students with course, year level, and section"
            >
              Export Students
            </button>
            <button
              onClick={exportQRCodes}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
              title="Export QR codes for all students"
            >
              Export QR Codes
            </button>
            <button
              onClick={exportQRCodesZip}
              className="bg-indigo-800 text-white px-4 py-2 rounded-lg hover:bg-indigo-900"
              title="Export QR images (PNG) for all students as ZIP"
            >
              Export QR Images (ZIP)
            </button>
            <button
              onClick={() => setShowBulkModal(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              Bulk Upload
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Add Student
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <input 
            type="text" 
            placeholder="Search by Name or ID..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="border border-gray-300 p-2 rounded-lg w-full md:w-1/3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={courseFilter}
            onChange={e => setCourseFilter(e.target.value)}
            className="border border-gray-300 p-2 rounded-lg w-full md:w-1/4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Courses</option>
            {uniqueCourses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {fetchLoading && !students.length ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Photo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gender
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Course
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Year
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Section
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredStudents.map((student, idx) => (
                  <tr key={student.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{idx + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {student.photo ? (
                        <img src={student.photo} alt={student.name} className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-gray-600">
                          {student.name.charAt(0)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{student.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{student.studentId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">{student.email || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">{student.gender || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">{student.course || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">{student.yearLevel || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">{student.section || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap space-x-2">
                      <button
                        onClick={() => setSelectedStudent(student)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View QR
                      </button>
                      <button
                        onClick={() => openEdit(student)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(student.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">{editingStudentId ? 'Edit Student' : 'Add Student'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student ID</label>
                <input
                  type="text"
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email (optional)</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender (optional)</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Select...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course (optional)</label>
                <input
                  type="text"
                  value={formData.course}
                  onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., BS Computer Science"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year Level (optional)</label>
                <input
                  type="text"
                  value={formData.yearLevel}
                  onChange={(e) => setFormData({ ...formData, yearLevel: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., 1st Year"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Section (optional)</label>
                <input
                  type="text"
                  value={formData.section}
                  onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., A"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Photo URL (optional)</label>
                <input
                  type="text"
                  value={formData.photo}
                  onChange={(e) => setFormData({ ...formData, photo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingStudentId(null); setFormData({ name: '', studentId: '', photo: '', email: '', gender: '', course: '', yearLevel: '', section: '' }) }}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fetchLoading}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {fetchLoading ? (editingStudentId ? 'Saving...' : 'Adding...') : (editingStudentId ? 'Save Changes' : 'Add Student')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Bulk Upload Students</h2>
            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-2">CSV Format Instructions:</h3>
              <ul className="list-disc list-inside text-blue-700 text-sm">
                <li>Required columns: <code>Name</code>, <code>Student ID</code></li>
                <li>Optional columns: <code>Email</code>, <code>Gender</code>, <code>Course</code>, <code>Year Level</code>, <code>Section</code>, <code>Photo URL</code></li>
                <li>Example:</li>
              </ul>
              <pre className="mt-2 p-2 bg-blue-100 rounded text-xs overflow-x-auto">
                Name,Student ID,Email,Gender,Course,Year Level,Section,Photo URL
                John Doe,S123,john@school.com,Male,BS CS,1st Year,A,
                Jane Smith,S456,jane@school.com,Female,BS IT,2nd Year,B,
              </pre>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select CSV File</label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100
                "
              />
            </div>
            {bulkPreview.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold text-gray-800 mb-2">Preview ({bulkPreview.length} students)</h3>
                <div className="border rounded-lg overflow-x-auto max-h-60 overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Student ID</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Gender</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Course</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Year</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Section</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {bulkPreview.map((student, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 text-sm">{student.name}</td>
                          <td className="px-4 py-2 text-sm">{student.studentId}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{student.email || '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{student.gender || '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{student.course || '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{student.yearLevel || '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{student.section || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowBulkModal(false)
                  setBulkFile(null)
                  setBulkPreview([])
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkUpload}
                disabled={bulkLoading || !bulkPreview.length}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {bulkLoading ? 'Uploading...' : `Upload ${bulkPreview.length} Students`}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Student QR Code</h2>
              <button
                onClick={() => setSelectedStudent(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col items-center space-y-4">
              {selectedStudent.photo ? (
                <img src={selectedStudent.photo} alt={selectedStudent.name} className="w-32 h-32 rounded-full object-cover" />
              ) : (
                <div className="w-32 h-32 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-4xl">
                  {selectedStudent.name.charAt(0)}
                </div>
              )}
              <h3 className="text-lg font-semibold">{selectedStudent.name}</h3>
              <p className="text-gray-600">ID: {selectedStudent.studentId}</p>
              <QRCodeSVG value={selectedStudent.qrCode} size={256} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
