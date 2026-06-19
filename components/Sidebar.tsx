'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, UserPlus, Calendar, Scan, FileText, LogOut, Home } from 'lucide-react'

export default function Sidebar() {
  const { data: session } = useSession()
  const pathname = usePathname()

  const isActive = (path: string) => pathname === path

  return (
    <div className="w-64 bg-gray-900 text-white h-screen fixed left-0 top-0">
      <div className="p-6">
        <h1 className="text-xl font-bold">QR Attendance</h1>
      </div>
      <nav className="mt-6">
        <ul className="space-y-2">
          <li>
            <Link
              href="/dashboard"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 ${isActive('/dashboard') ? 'bg-blue-600' : ''}`}
            >
              <Home size={20} />
              <span>Dashboard</span>
            </Link>
          </li>
          {(session?.user as any)?.role === 'ADMIN' && (
              <li>
                <Link
                  href="/students"
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 ${isActive('/students') ? 'bg-blue-600' : ''}`}
                >
                  <Users size={20} />
                  <span>Students</span>
                </Link>
              </li>
            )}
          {(session?.user as any)?.role === 'ADMIN' && (
              <li>
                <Link
                  href="/events"
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 ${isActive('/events') ? 'bg-blue-600' : ''}`}
                >
                  <Calendar size={20} />
                  <span>Events</span>
                </Link>
              </li>
            )}
          <li>
            <Link
              href="/scan"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 ${isActive('/scan') ? 'bg-blue-600' : ''}`}
            >
              <Scan size={20} />
              <span>Scan QR</span>
            </Link>
          </li>
          {(session?.user as any)?.role === 'ADMIN' && (
              <li>
                <Link
                  href="/reports"
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 ${isActive('/reports') ? 'bg-blue-600' : ''}`}
                >
                  <FileText size={20} />
                  <span>Reports</span>
                </Link>
              </li>
            )}
          {(session?.user as any)?.role === 'ADMIN' && (
              <li>
                <Link
                  href="/users"
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 ${isActive('/users') ? 'bg-blue-600' : ''}`}
                >
                  <UserPlus size={20} />
                  <span>Users</span>
                </Link>
              </li>
            )}
        </ul>
      </nav>
      <div className="absolute bottom-6 left-6 right-6">
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 w-full text-left"
        >
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
      <div className="absolute bottom-20 left-6 right-6">
          <p className="text-gray-400 text-sm">
            Logged in as: <span className="text-white">{session?.user?.name || (session?.user as any)?.username || 'User'}</span>
          </p>
          <p className="text-gray-500 text-xs">
            Role: {(session?.user as any)?.role}
          </p>
        </div>
    </div>
  )
}
