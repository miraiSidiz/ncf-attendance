'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Users, UserPlus, Calendar, Scan, FileText, LogOut, Home, Menu, X } from 'lucide-react'

export default function Sidebar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (path: string) => pathname === path

  const toggleMobileMenu = () => setMobileOpen(!mobileOpen)
  const closeMobileMenu = () => setMobileOpen(false)

  return (
    <>
      {/* Mobile Top Navigation Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-gray-900 text-white flex items-center justify-between px-4 z-30 shadow-md">
        <button
          onClick={toggleMobileMenu}
          className="p-2 hover:bg-gray-800 rounded-lg focus:outline-none"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <span className="font-bold text-lg">QR Attendance</span>
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-sm">
          {session?.user?.name?.charAt(0) || session?.user?.email?.charAt(0) || 'U'}
        </div>
      </div>

      {/* Backdrop overlay on mobile */}
      {mobileOpen && (
        <div
          onClick={closeMobileMenu}
          className="md:hidden fixed inset-0 bg-black/60 z-30 transition-opacity"
        />
      )}

      {/* Sidebar Drawer */}
      <div
        className={`w-64 bg-gray-900 text-white h-screen fixed left-0 top-0 z-40 transition-transform duration-300 ease-in-out md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <h1 className="text-xl font-bold">QR Attendance</h1>
          <button
            onClick={closeMobileMenu}
            className="md:hidden p-1 hover:bg-gray-800 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="mt-6 px-4">
          <ul className="space-y-2">
            <li>
              <Link
                href="/dashboard"
                onClick={closeMobileMenu}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors ${
                  isActive('/dashboard') ? 'bg-blue-600' : ''
                }`}
              >
                <Home size={20} />
                <span>Dashboard</span>
              </Link>
            </li>
            {(session?.user as any)?.role === 'ADMIN' && (
              <li>
                <Link
                  href="/students"
                  onClick={closeMobileMenu}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors ${
                    isActive('/students') ? 'bg-blue-600' : ''
                  }`}
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
                  onClick={closeMobileMenu}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors ${
                    isActive('/events') ? 'bg-blue-600' : ''
                  }`}
                >
                  <Calendar size={20} />
                  <span>Events</span>
                </Link>
              </li>
            )}
            <li>
              <Link
                href="/scan"
                onClick={closeMobileMenu}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors ${
                  isActive('/scan') ? 'bg-blue-600' : ''
                }`}
              >
                <Scan size={20} />
                <span>Scan QR</span>
              </Link>
            </li>
            {(session?.user as any)?.role === 'ADMIN' && (
              <li>
                <Link
                  href="/reports"
                  onClick={closeMobileMenu}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors ${
                    isActive('/reports') ? 'bg-blue-600' : ''
                  }`}
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
                  onClick={closeMobileMenu}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors ${
                    isActive('/users') ? 'bg-blue-600' : ''
                  }`}
                >
                  <UserPlus size={20} />
                  <span>Users</span>
                </Link>
              </li>
            )}
          </ul>
        </nav>
        <div className="absolute bottom-6 left-6 right-6 space-y-4">
          <div className="border-t border-gray-800 pt-4">
            <p className="text-gray-400 text-sm truncate">
              Logged in as: <span className="text-white font-medium">{session?.user?.name || (session?.user as any)?.username || 'User'}</span>
            </p>
            <p className="text-gray-500 text-xs">
              Role: {(session?.user as any)?.role}
            </p>
          </div>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 w-full text-left text-red-400 hover:text-red-300 transition-colors"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </>
  )
}
