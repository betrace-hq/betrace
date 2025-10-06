import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { workosAuth } from '@/lib/auth/workos'
import { useAuth } from '@/lib/auth/auth-context'

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallbackPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      code: (search.code as string) || '',
      state: (search.state as string) || '',
      error: (search.error as string) || '',
      error_description: (search.error_description as string) || '',
    }
  },
})

function AuthCallbackPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { code, state, error, error_description } = Route.useSearch()
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      setLoading(true)
      setAuthError(null)

      try {
        // Handle OAuth error
        if (error) {
          throw new Error(error_description || error)
        }

        // Validate required parameters
        if (!code || !state) {
          throw new Error('Missing required authentication parameters')
        }

        // Exchange code for session
        const session = await workosAuth.handleCallback(code, state)
        login(session.user, session.tenant)

        // Redirect to dashboard on successful authentication
        navigate({ to: '/dashboard' })

      } catch (err) {
        console.error('Authentication callback error:', err)
        setAuthError(err instanceof Error ? err.message : 'Authentication failed')

        // Redirect back to auth page after a delay
        setTimeout(() => {
          navigate({ to: '/auth' })
        }, 3000)

      } finally {
        setLoading(false)
      }
    }

    handleCallback()
  }, [code, state, error, error_description, navigate, login])

  // Show loading or error state
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">FLUO</h1>
          <p className="mt-2 text-sm text-gray-600">
            Processing authentication...
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {authError ? (
            <div className="text-center">
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                <h3 className="font-medium mb-2">Authentication Error</h3>
                <p className="text-sm">{authError}</p>
              </div>
              <p className="text-sm text-gray-600">
                Redirecting to login page...
              </p>
            </div>
          ) : (
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Completing sign in...
              </h3>
              <p className="text-sm text-gray-600">
                Please wait while we set up your session
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}