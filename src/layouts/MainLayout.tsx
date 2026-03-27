import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { 
  LayoutDashboard, 
  ClipboardList, 
  FileText, 
  User, 
  LogOut, 
  Menu,
  X,
  Building2
} from 'lucide-react'
import { signOut } from '@/services/supabase/auth'
import { useAuthStore } from '@/stores/authStore'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Survey', href: '/surveys', icon: ClipboardList },
  { name: 'Laporan', href: '/reports', icon: FileText },
]

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-40 w-64 bg-white">
            <SidebarContent 
              navItems={navigation} 
              location={location} 
              user={user}
              onLogout={handleLogout}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          <SidebarContent 
            navItems={navigation} 
            location={location} 
            user={user}
            onLogout={handleLogout}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-md text-gray-400 hover:text-gray-500">
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex items-center">
              <Building2 className="h-6 w-6 text-government-green" />
              <span className="ml-2 font-semibold text-gray-900">SPKBG</span>
            </div>
            <div className="w-8" />
          </div>
        </div>

        {/* Page content */}
        <main className="py-6 px-4 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function SidebarContent({ 
  navItems, 
  location, 
  user, 
  onLogout, 
  onClose 
}: { 
  navItems: typeof navigation
  location: { pathname: string }
  user: any
  onLogout: () => void
  onClose?: () => void
}) {
  return (
    <>
      <div className="flex items-center h-16 px-6 border-b border-gray-200">
        <Building2 className="h-8 w-8 text-government-green" />
        <span className="ml-3 text-lg font-semibold text-gray-900">SPKBG</span>
        {onClose && (
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-500">
            <X className="h-6 w-6" />
          </button>
        )}
      </div>
      
      <nav className="flex-1 px-4 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.href)
          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={onClose}
              className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive 
                  ? 'bg-government-green text-white' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <item.icon className={`mr-3 h-5 w-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 rounded-full bg-government-green flex items-center justify-center">
            <User className="h-4 w-4 text-white" />
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-900">{user?.name || 'User'}</p>
            <p className="text-xs text-gray-500 capitalize">{user?.role || 'User'}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex w-full items-center px-4 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Keluar
        </button>
      </div>
    </>
  )
}
