import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react'

export const Route = createFileRoute('/status')({
  component: StatusPage,
})

interface ServiceStatus {
  name: string
  status: 'ok' | 'degraded' | 'dead'
  message?: string
  endpoint: string
  uptime?: number
}

const services = [
  { name: 'Backend', endpoint: 'http://localhost:12011/v1/health', healthKey: 'status' },
  { name: 'Loki', endpoint: 'http://localhost:3100/ready', healthKey: null },
  { name: 'Tempo', endpoint: 'http://localhost:3200/ready', healthKey: null },
  { name: 'Prometheus', endpoint: 'http://localhost:9090/-/ready', healthKey: null },
  { name: 'Alloy', endpoint: 'http://localhost:12345/ready', healthKey: null },
  { name: 'Grafana', endpoint: 'http://localhost:12015/api/health', healthKey: 'database' },
]

async function checkServiceHealth(endpoint: string, healthKey: string | null): Promise<ServiceStatus['status']> {
  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    })

    if (!response.ok) {
      return 'dead'
    }

    if (healthKey) {
      const data = await response.json()
      const health = healthKey.split('.').reduce((obj, key) => obj?.[key], data as any)

      if (health === 'HEALTHY' || health === 'ok') {
        return 'ok'
      } else if (health === 'UNHEALTHY') {
        return 'degraded'
      }
    }

    return 'ok'
  } catch (error) {
    return 'dead'
  }
}

function StatusPage() {
  const { data: statuses, isLoading, error } = useQuery({
    queryKey: ['service-status'],
    queryFn: async (): Promise<ServiceStatus[]> => {
      const results = await Promise.all(
        services.map(async (service) => {
          const status = await checkServiceHealth(service.endpoint, service.healthKey)
          return {
            name: service.name,
            status,
            endpoint: service.endpoint,
          }
        })
      )
      return results
    },
    refetchInterval: 10000, // Refetch every 10 seconds
  })

  const overallStatus = statuses?.every((s) => s.status === 'ok')
    ? 'ok'
    : statuses?.some((s) => s.status === 'degraded')
    ? 'degraded'
    : 'dead'

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">BeTrace System Status</h1>
        <p className="text-muted-foreground">
          Real-time monitoring of all BeTrace stack components
        </p>
      </div>

      {/* Overall Status */}
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-1">Overall System Status</h2>
            <p className="text-sm text-muted-foreground">
              All systems monitored in real-time
            </p>
          </div>
          <StatusBadge status={isLoading ? 'degraded' : overallStatus} large />
        </div>
      </Card>

      {/* Service List */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold mb-4">Component Status</h3>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card className="p-6 border-destructive">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              <p>Failed to fetch service status</p>
            </div>
          </Card>
        ) : (
          statuses?.map((service) => (
            <Card key={service.name} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <StatusIcon status={service.status} />
                    <div>
                      <h4 className="font-medium">{service.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {service.endpoint}
                      </p>
                    </div>
                  </div>
                </div>
                <StatusBadge status={service.status} />
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Legend */}
      <Card className="p-6 mt-8">
        <h3 className="font-semibold mb-3">Status Legend</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <div>
              <p className="font-medium">Operational</p>
              <p className="text-muted-foreground text-xs">Service is healthy and responding</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <div>
              <p className="font-medium">Degraded</p>
              <p className="text-muted-foreground text-xs">Service is responding but unhealthy</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-600" />
            <div>
              <p className="font-medium">Down</p>
              <p className="text-muted-foreground text-xs">Service is not responding</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Auto-refresh indicator */}
      <div className="mt-6 text-center text-sm text-muted-foreground">
        Auto-refreshing every 10 seconds
      </div>
    </div>
  )
}

function StatusIcon({ status }: { status: ServiceStatus['status'] }) {
  switch (status) {
    case 'ok':
      return <CheckCircle2 className="h-5 w-5 text-green-600" />
    case 'degraded':
      return <AlertCircle className="h-5 w-5 text-yellow-600" />
    case 'dead':
      return <XCircle className="h-5 w-5 text-red-600" />
  }
}

function StatusBadge({ status, large }: { status: ServiceStatus['status']; large?: boolean }) {
  const className = large ? 'text-base px-4 py-2' : ''

  switch (status) {
    case 'ok':
      return (
        <Badge variant="default" className={`bg-green-600 hover:bg-green-700 ${className}`}>
          Operational
        </Badge>
      )
    case 'degraded':
      return (
        <Badge variant="default" className={`bg-yellow-600 hover:bg-yellow-700 ${className}`}>
          Degraded
        </Badge>
      )
    case 'dead':
      return (
        <Badge variant="destructive" className={className}>
          Down
        </Badge>
      )
  }
}
