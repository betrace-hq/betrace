import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function SignalsPageMinimal() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Security Signals</h1>
          <p className="text-gray-600 dark:text-gray-400">Monitor and manage behavioral anomalies detected by FLUO</p>
        </div>

        <Card className="border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle>Signals Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 dark:text-gray-400">
              Signals dashboard is temporarily simplified to prevent VM crashes.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}