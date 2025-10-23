import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { usePermissions } from '@/lib/security/auth-guard'
import { redTeamTesting, type SecurityTestResult, type SecurityTest } from '@/lib/security/red-team'
import { auditLogger, type AuditEvent } from '@/lib/monitoring/audit-logger'
import { errorHandler, type ErrorInfo } from '@/lib/errors/error-handler'
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  FileText,
  Bug,
  Zap,
  RefreshCw,
  Download,
  Eye
} from 'lucide-react'

export function SecurityDashboard() {
  const navigate = useNavigate()
  const { hasMinRole } = usePermissions()
  const [activeTab, setActiveTab] = useState('overview')
  const [testResults, setTestResults] = useState<Array<SecurityTest & { result: SecurityTestResult }>>([])
  const [isRunningTests, setIsRunningTests] = useState(false)
  const [securityMetrics, setSecurityMetrics] = useState<any>(null)
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [errors, setErrors] = useState<ErrorInfo[]>([])

  useEffect(() => {
    loadSecurityData()
  }, [])

  const loadSecurityData = () => {
    // Load security metrics
    const metrics = auditLogger.getSecurityMetrics()
    setSecurityMetrics(metrics)

    // Load recent audit events
    const events = auditLogger.getEvents({ limit: 50 })
    setAuditEvents(events)

    // Load recent errors
    const recentErrors = errorHandler.getErrors({ limit: 50 })
    setErrors(recentErrors)
  }

  const runSecurityTests = async () => {
    if (!hasMinRole('admin')) {
      alert('Admin access required to run security tests')
      return
    }

    setIsRunningTests(true)
    try {
      const result = await redTeamTesting.runAllTests()
      setTestResults(result.results)
    } catch (error) {
      console.error('Failed to run security tests:', error)
      alert('Failed to run security tests')
    } finally {
      setIsRunningTests(false)
    }
  }

  const getStatusIcon = (passed: boolean) => {
    return passed ? (
      <CheckCircle className="w-4 h-4 text-green-600" />
    ) : (
      <XCircle className="w-4 h-4 text-red-600" />
    )
  }

  const getSeverityBadge = (severity: string) => {
    const variants = {
      low: 'secondary',
      medium: 'default',
      high: 'destructive',
      critical: 'destructive'
    } as const

    return (
      <Badge variant={variants[severity as keyof typeof variants] || 'secondary'}>
        {severity.toUpperCase()}
      </Badge>
    )
  }

  const exportAuditLog = () => {
    const csv = auditLogger.exportEvents('csv')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `betrace-audit-log-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const clearAuditLog = () => {
    if (confirm('Are you sure you want to clear the audit log? This action cannot be undone.')) {
      auditLogger.clearEvents()
      loadSecurityData()
    }
  }

  if (!hasMinRole('admin')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">Admin access required to view security dashboard</p>
          <Button onClick={() => navigate({ to: '/dashboard' })}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-red-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Security Dashboard</h1>
                <p className="text-sm text-gray-600">
                  Monitor security posture and run defensive tests
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={loadSecurityData} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={() => navigate({ to: '/dashboard' })} variant="outline">
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="testing">Red Team Tests</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
            <TabsTrigger value="errors">Error Monitoring</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Security Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <AlertTriangle className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {securityMetrics?.failedLogins || 0}
                  </div>
                  <div className="text-sm text-gray-600">Failed Logins</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <Zap className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {securityMetrics?.rateLimitViolations || 0}
                  </div>
                  <div className="text-sm text-gray-600">Rate Limits</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <Shield className="w-8 h-8 text-red-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {securityMetrics?.permissionDenials || 0}
                  </div>
                  <div className="text-sm text-gray-600">Access Denied</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <Bug className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {securityMetrics?.xssAttempts || 0}
                  </div>
                  <div className="text-sm text-gray-600">XSS Attempts</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <Activity className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {securityMetrics?.injectionAttempts || 0}
                  </div>
                  <div className="text-sm text-gray-600">Injection Attempts</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {securityMetrics?.suspiciousActivities || 0}
                  </div>
                  <div className="text-sm text-gray-600">Suspicious Activity</div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bug className="w-5 h-5" />
                    Security Testing
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    Run comprehensive security tests to validate defenses against common attacks.
                  </p>
                  <Button
                    onClick={runSecurityTests}
                    disabled={isRunningTests}
                    className="w-full"
                  >
                    {isRunningTests ? 'Running Tests...' : 'Run Security Tests'}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Audit & Compliance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    Review audit logs and export compliance reports for security analysis.
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={exportAuditLog} variant="outline" className="flex-1">
                      Export Logs
                    </Button>
                    <Button onClick={() => setActiveTab('audit')} className="flex-1">
                      View Audit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Red Team Testing Tab */}
          <TabsContent value="testing" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Bug className="w-5 h-5" />
                    Security Test Results
                  </CardTitle>
                  <Button
                    onClick={runSecurityTests}
                    disabled={isRunningTests}
                  >
                    {isRunningTests ? 'Running...' : 'Run Tests'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {testResults.length === 0 ? (
                  <div className="text-center py-8">
                    <Bug className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No test results available</p>
                    <p className="text-sm text-gray-500">Run security tests to see results</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead>Test Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Severity</TableHead>
                          <TableHead>Result</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {testResults.map((test, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              {getStatusIcon(test.result.passed)}
                            </TableCell>
                            <TableCell className="font-medium">
                              {test.name}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {test.category.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {getSeverityBadge(test.severity)}
                            </TableCell>
                            <TableCell>
                              <div className="max-w-xs truncate" title={test.result.message}>
                                {test.result.message}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="audit" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Audit Events
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button onClick={exportAuditLog} variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                    <Button onClick={clearAuditLog} variant="outline" size="sm">
                      Clear Log
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Event Type</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditEvents.slice(0, 20).map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className="text-sm">
                            {new Date(event.timestamp).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {event.type.replace('.', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {getSeverityBadge(event.severity)}
                          </TableCell>
                          <TableCell>
                            {event.userEmail || 'Anonymous'}
                          </TableCell>
                          <TableCell>
                            {event.success ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600" />
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <div className="truncate text-sm">
                              {event.errorMessage || JSON.stringify(event.details)}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Error Monitoring Tab */}
          <TabsContent value="errors" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Error Monitoring
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Retryable</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {errors.slice(0, 20).map((error) => (
                        <TableRow key={error.id}>
                          <TableCell className="text-sm">
                            {new Date(error.timestamp).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {error.category}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {getSeverityBadge(error.severity)}
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <div className="truncate" title={error.message}>
                              {error.message}
                            </div>
                          </TableCell>
                          <TableCell>
                            {error.userId || 'Anonymous'}
                          </TableCell>
                          <TableCell>
                            {error.retryable ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}