import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { useAuth } from '@/lib/auth/auth-context'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { User, LogOut, Settings, LayoutDashboard } from 'lucide-react'

export function Header() {
  const navigate = useNavigate()
  const router = useRouter()
  const { user, isAuthenticated, isDemoMode, logout } = useAuth()

  // Get current page info for title display
  const currentPath = router.state.location.pathname
  const pageInfo = {
    '/dashboard': { title: 'Dashboard', description: 'Demo Organization • demo@betrace.dev' },
    '/signals': { title: 'Signals', description: 'Monitor and manage behavioral assurance signals' },
    '/rules': { title: 'Rules', description: 'Manage behavioral assurance rules for your services' },
  }[currentPath]

  const handleLogout = () => {
    logout()
    navigate({ to: '/auth' })
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200/50 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 text-gray-900 dark:bg-gray-900/95 dark:border-gray-800 dark:text-gray-100">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo and Brand */}
        <div className="flex items-center space-x-4">
          <Link to="/" className="flex items-center space-x-2">
            <img
              src="/logo.svg"
              alt="BeTrace Logo"
              className="h-8 w-8"
            />
            <span className="font-bold text-xl tracking-tight border-b-2 border-green-500">BeTrace</span>
          </Link>

          {/* Navigation for authenticated users */}
          {isAuthenticated && (
            <div className="flex items-center ml-8">
              <nav className="hidden md:flex items-center space-x-6">
                <Link
                  to="/dashboard"
                  inactiveProps={{
                    className: "text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:text-blue-700 dark:hover:text-blue-400 border-b-2 border-transparent pb-0.5"
                  }}
                  activeProps={{
                    className: "text-sm font-semibold text-blue-700 dark:text-blue-400 border-b-2 border-blue-700 dark:border-blue-400 pb-0.5"
                  }}
                >
                  Dashboard
                </Link>
                <Link
                  to="/signals"
                  search={{ status: '', severity: '', service: '', page: 1, limit: 20 }}
                  inactiveProps={{
                    className: "text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:text-blue-700 dark:hover:text-blue-400 border-b-2 border-transparent pb-0.5"
                  }}
                  activeProps={{
                    className: "text-sm font-semibold text-blue-700 dark:text-blue-400 border-b-2 border-blue-700 dark:border-blue-400 pb-0.5"
                  }}
                >
                  Signals
                </Link>
                <Link
                  to="/rules"
                  search={{ search: '', active: false }}
                  inactiveProps={{
                    className: "text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:text-blue-700 dark:hover:text-blue-400 border-b-2 border-transparent pb-0.5"
                  }}
                  activeProps={{
                    className: "text-sm font-semibold text-blue-700 dark:text-blue-400 border-b-2 border-blue-700 dark:border-blue-400 pb-0.5"
                  }}
                >
                  Rules
                </Link>
              </nav>

              {/* Page Title */}
              {pageInfo && (
                <div className="hidden lg:flex items-center ml-8 pl-8 border-l border-gray-200/50 dark:border-gray-700">
                  <div>
                    <h1 className="text-sm font-semibold">{pageInfo.title}</h1>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{pageInfo.description}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right side actions */}
        <div className="flex items-center space-x-2">
          {/* Theme Toggle */}
          <ThemeToggle />

          {isAuthenticated ? (
            <div className="flex items-center space-x-2">
              {/* Demo Mode Indicator */}
              {isDemoMode && (
                <div className="hidden sm:flex items-center px-3 py-1.5 rounded-md bg-amber-100 border border-amber-300 text-amber-900 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-200 text-xs font-semibold">
                  Demo Mode
                </div>
              )}

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-9 w-9 rounded-full p-0 hover:bg-gray-100 dark:hover:bg-gray-800">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white font-semibold text-sm border-2 border-gray-200 dark:border-gray-700">
                      {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      {user?.firstName && (
                        <p className="font-medium text-sm">
                          {user.firstName} {user.lastName}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {user?.email}
                      </p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate({ to: '/dashboard' })}>
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate({ to: '/tenant' })}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/auth">Sign In</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/auth">Get Started</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}