import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { User, LogOut, Settings, LayoutDashboard } from 'lucide-react'

export interface HeaderDisplayProps {
  isAuthenticated?: boolean
  isDemoMode?: boolean
  userName?: string
  userEmail?: string
  userInitial?: string
  currentPage?: 'dashboard' | 'signals' | 'rules' | null
  onLogout?: () => void
  onNavigate?: (page: string) => void
}

export function HeaderDisplay({
  isAuthenticated = false,
  isDemoMode = false,
  userName = 'John Doe',
  userEmail = 'john@example.com',
  userInitial = 'J',
  currentPage = null,
  onLogout,
  onNavigate,
}: HeaderDisplayProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200/50 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 text-gray-900 dark:bg-gray-900/95 dark:border-gray-800 dark:text-gray-100">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo and Brand */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 bg-blue-600 rounded"></div>
            <span className="font-bold text-xl tracking-tight border-b-2 border-green-500">FLUO</span>
          </div>

          {/* Navigation for authenticated users */}
          {isAuthenticated && (
            <div className="flex items-center ml-8">
              <nav className="hidden md:flex items-center space-x-6">
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    onNavigate?.('dashboard')
                  }}
                  className={
                    currentPage === 'dashboard'
                      ? 'text-sm font-semibold text-blue-700 dark:text-blue-400 border-b-2 border-blue-700 dark:border-blue-400 pb-0.5'
                      : 'text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:text-blue-700 dark:hover:text-blue-400 border-b-2 border-transparent pb-0.5'
                  }
                >
                  Dashboard
                </a>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    onNavigate?.('signals')
                  }}
                  className={
                    currentPage === 'signals'
                      ? 'text-sm font-semibold text-blue-700 dark:text-blue-400 border-b-2 border-blue-700 dark:border-blue-400 pb-0.5'
                      : 'text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:text-blue-700 dark:hover:text-blue-400 border-b-2 border-transparent pb-0.5'
                  }
                >
                  Signals
                </a>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    onNavigate?.('rules')
                  }}
                  className={
                    currentPage === 'rules'
                      ? 'text-sm font-semibold text-blue-700 dark:text-blue-400 border-b-2 border-blue-700 dark:border-blue-400 pb-0.5'
                      : 'text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:text-blue-700 dark:hover:text-blue-400 border-b-2 border-transparent pb-0.5'
                  }
                >
                  Rules
                </a>
              </nav>
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
                  <Button variant="ghost" className="h-9 w-9 rounded-full p-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white font-semibold text-sm border-2 border-gray-200 dark:border-gray-700">
                      {userInitial}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <div className="flex flex-col space-y-1 p-2">
                    <p className="text-sm font-medium">{userName}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{userEmail}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <>
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
              <Button size="sm">Get Started</Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
