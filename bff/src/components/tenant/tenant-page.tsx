import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/lib/auth/auth-context'
import {
  Building,
  Users,
  CreditCard,
  Settings,
  Shield,
  Zap,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react'

export function TenantPage() {
  const navigate = useNavigate()
  const { tenant, user, hasMinRole } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: tenant?.name || '',
    plan: tenant?.plan || 'pro',
  })

  // Mock data for demonstration
  const usageStats = {
    signals: { used: 2847, limit: 10000 },
    rules: { used: 23, limit: 100 },
    users: { used: 8, limit: 50 },
  }

  const recentActivity = [
    {
      id: 1,
      type: 'user_added',
      description: 'New user added: john@company.com',
      timestamp: '2 hours ago',
    },
    {
      id: 2,
      type: 'rule_created',
      description: 'Rule "High Error Rate" created',
      timestamp: '4 hours ago',
    },
    {
      id: 3,
      type: 'plan_updated',
      description: 'Plan upgraded to Pro',
      timestamp: '2 days ago',
    },
  ]

  const teamMembers = [
    {
      id: 1,
      name: 'John Smith',
      email: 'john@company.com',
      role: 'admin',
      status: 'active',
      lastLogin: '2 hours ago',
    },
    {
      id: 2,
      name: 'Sarah Johnson',
      email: 'sarah@company.com',
      role: 'member',
      status: 'active',
      lastLogin: '1 day ago',
    },
    {
      id: 3,
      name: 'Mike Chen',
      email: 'mike@company.com',
      role: 'viewer',
      status: 'inactive',
      lastLogin: '1 week ago',
    },
  ]

  const handleSave = () => {
    // TODO: Implement tenant update API call
    console.log('Saving tenant updates:', formData)
    setIsEditing(false)
  }

  const getUsagePercentage = (used: number, limit: number) => {
    return Math.round((used / limit) * 100)
  }

  const getUsageBadgeVariant = (percentage: number) => {
    if (percentage >= 90) return 'destructive'
    if (percentage >= 75) return 'default'
    return 'secondary'
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4" />
      case 'member':
        return <Users className="w-4 h-4" />
      case 'viewer':
        return <Users className="w-4 h-4" />
      default:
        return <Users className="w-4 h-4" />
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'inactive':
        return <Clock className="w-4 h-4 text-gray-400" />
      default:
        return <AlertCircle className="w-4 h-4 text-red-600" />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <Building className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tenant Management</h1>
                <p className="text-sm text-gray-600">
                  Manage your organization settings and billing
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate({ to: '/dashboard' })}
              variant="outline"
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Organization Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Organization Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Organization Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="plan">Plan</Label>
                      <Select value={formData.plan} onValueChange={(value) => setFormData(prev => ({ ...prev, plan: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="starter">Starter</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                          <SelectItem value="enterprise">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSave}>Save Changes</Button>
                      <Button variant="outline" onClick={() => setIsEditing(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <Label>Organization Name</Label>
                      <p className="text-lg font-medium">{tenant?.name}</p>
                    </div>
                    <div>
                      <Label>Plan</Label>
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="capitalize">
                          {tenant?.plan}
                        </Badge>
                        <Button variant="link" size="sm">
                          Upgrade Plan
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label>Tenant ID</Label>
                      <p className="text-sm text-gray-600 font-mono">{tenant?.id}</p>
                    </div>
                    {hasMinRole('admin') && (
                      <Button onClick={() => setIsEditing(true)}>
                        Edit Settings
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Usage Statistics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Usage Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {usageStats.signals.used.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">
                      of {usageStats.signals.limit.toLocaleString()} signals
                    </div>
                    <Badge
                      variant={getUsageBadgeVariant(getUsagePercentage(usageStats.signals.used, usageStats.signals.limit))}
                      className="mt-2"
                    >
                      {getUsagePercentage(usageStats.signals.used, usageStats.signals.limit)}% used
                    </Badge>
                  </div>

                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {usageStats.rules.used}
                    </div>
                    <div className="text-sm text-gray-600">
                      of {usageStats.rules.limit} rules
                    </div>
                    <Badge
                      variant={getUsageBadgeVariant(getUsagePercentage(usageStats.rules.used, usageStats.rules.limit))}
                      className="mt-2"
                    >
                      {getUsagePercentage(usageStats.rules.used, usageStats.rules.limit)}% used
                    </Badge>
                  </div>

                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {usageStats.users.used}
                    </div>
                    <div className="text-sm text-gray-600">
                      of {usageStats.users.limit} users
                    </div>
                    <Badge
                      variant={getUsageBadgeVariant(getUsagePercentage(usageStats.users.used, usageStats.users.limit))}
                      className="mt-2"
                    >
                      {getUsagePercentage(usageStats.users.used, usageStats.users.limit)}% used
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Team Members */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Team Members
                  </CardTitle>
                  {hasMinRole('admin') && (
                    <Button size="sm">
                      Invite User
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Login</TableHead>
                        {hasMinRole('admin') && <TableHead>Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamMembers.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{member.name}</TableCell>
                          <TableCell>{member.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="flex items-center gap-1 w-fit">
                              {getRoleIcon(member.role)}
                              {member.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(member.status)}
                              <span className="capitalize">{member.status}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {member.lastLogin}
                          </TableCell>
                          {hasMinRole('admin') && (
                            <TableCell>
                              <Button size="sm" variant="outline">
                                Edit
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Billing Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Billing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <Label>Current Plan</Label>
                    <p className="font-medium capitalize">{tenant?.plan} Plan</p>
                  </div>
                  <div>
                    <Label>Next Billing Date</Label>
                    <p className="text-sm text-gray-600">January 1, 2025</p>
                  </div>
                  <div>
                    <Label>Monthly Cost</Label>
                    <p className="font-medium">$299/month</p>
                  </div>
                  <Button variant="outline" className="w-full">
                    View Billing History
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="text-sm">
                      <p className="font-medium">{activity.description}</p>
                      <p className="text-gray-500 text-xs">{activity.timestamp}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Support */}
            <Card>
              <CardHeader>
                <CardTitle>Support</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button variant="outline" className="w-full">
                    Contact Support
                  </Button>
                  <Button variant="outline" className="w-full">
                    View Documentation
                  </Button>
                  <Button variant="outline" className="w-full">
                    API Documentation
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}