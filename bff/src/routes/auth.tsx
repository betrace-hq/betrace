import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuth } from '@/lib/auth/auth-context'
import { Layout } from '@/components/layout/layout'
import { StyledCard, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/styled-card'
import { Button } from '@/components/ui/button'
import { alerts } from '@/lib/design-system'

export const Route = createFileRoute('/auth')({
  component: AuthPage,
})

function AuthPage() {
  const navigate = useNavigate()
  const { enableDemoMode, isLoading, isAuthenticated } = useAuth()

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate({ to: '/dashboard' })
    }
  }, [isAuthenticated, isLoading, navigate])

  return (
    <Layout>
      <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">FLUO</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Real-time Behavioral Assurance System
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <StyledCard>
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-center">
              Sign in to your account
            </CardTitle>
            <CardDescription className="text-center">
              Use your organization credentials to access FLUO
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status indicator */}
            <div className={`p-3 rounded-lg border ${alerts.success.container}`}>
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full mr-2 bg-green-500"></div>
                <span className={`text-sm ${alerts.success.description}`}>Ready to authenticate</span>
              </div>
            </div>

            <div className="space-y-4">
              <Button
                className="w-full"
                onClick={() => {
                  // TODO: Implement WorkOS SSO
                  console.log('SSO requested - WorkOS will handle this');
                }}
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Sign in with SSO'}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">Or</span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-800/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-600"
                onClick={async () => {
                  // Instant demo mode
                  await enableDemoMode();
                  navigate({ to: '/dashboard' });
                }}
              >
                🚀 Try Demo (Instant Access)
              </Button>
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
              <p>
                By signing in, you agree to our{' '}
                <a href="#" className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#" className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                  Privacy Policy
                </a>
              </p>
            </div>
          </CardContent>
        </StyledCard>
      </div>
      </div>
    </Layout>
  )
}