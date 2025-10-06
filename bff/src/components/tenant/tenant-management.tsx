import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Building2,
  Users,
  Settings,
  CreditCard,
  Shield,
  Database,
  Activity,
  Plus,
  Edit,
  Trash2,
  Mail,
  Phone,
  Globe,
  Calendar,
  Key,
  UserPlus,
  Copy,
  Check,
  AlertCircle,
  ChevronRight,
} from 'lucide-react'
import { useTenants } from '@/lib/hooks/use-tenants'
import { format } from 'date-fns'

export function TenantManagement() {
  const [selectedTab, setSelectedTab] = useState('overview')
  const [showAddUserDialog, setShowAddUserDialog] = useState(false)
  const [showAddTenantDialog, setShowAddTenantDialog] = useState(false)
  const [copiedApiKey, setCopiedApiKey] = useState(false)

  const { data: tenantsData, isLoading } = useTenants()
  const tenants = tenantsData?.tenants || []
  const currentTenant = tenants[0] || null

  const copyApiKey = (key: string) => {
    navigator.clipboard.writeText(key)
    setCopiedApiKey(true)
    setTimeout(() => setCopiedApiKey(false), 2000)
  }

  const mockTeamMembers = [
    {
      id: '1',
      name: 'Sarah Chen',
      email: 'sarah.chen@company.com',
      role: 'Admin',
      status: 'Active',
      lastLogin: '2024-01-15T10:30:00Z',
      joinedAt: '2023-08-01T00:00:00Z',
    },
    {
      id: '2',
      name: 'Michael Rodriguez',
      email: 'michael.r@company.com',
      role: 'Member',
      status: 'Active',
      lastLogin: '2024-01-15T09:15:00Z',
      joinedAt: '2023-09-15T00:00:00Z',
    },
    {
      id: '3',
      name: 'Emily Johnson',
      email: 'emily.j@company.com',
      role: 'Viewer',
      status: 'Invited',
      lastLogin: null,
      joinedAt: '2024-01-10T00:00:00Z',
    },
  ]

  const mockApiKeys = [
    {
      id: '1',
      name: 'Production API Key',
      key: 'fluo_live_sk_9f8e7d6c5b4a3',
      createdAt: '2023-12-01T00:00:00Z',
      lastUsed: '2024-01-15T10:00:00Z',
      permissions: ['read', 'write'],
    },
    {
      id: '2',
      name: 'Development API Key',
      key: 'fluo_test_sk_1a2b3c4d5e6f7',
      createdAt: '2023-11-15T00:00:00Z',
      lastUsed: '2024-01-14T16:30:00Z',
      permissions: ['read'],
    },
  ]

  const mockUsageMetrics = {
    signals: {
      current: 8234,
      limit: 10000,
      percentage: 82.34,
    },
    rules: {
      current: 42,
      limit: 100,
      percentage: 42,
    },
    storage: {
      current: 3.2,
      limit: 10,
      percentage: 32,
      unit: 'GB',
    },
    apiCalls: {
      current: 145678,
      limit: 500000,
      percentage: 29.14,
    },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Tenant Management</h2>
          <p className="text-gray-500">Manage your organization and team settings</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowAddTenantDialog(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Organization
          </Button>
        </div>
      </div>

      {/* Current Tenant Card */}
      {currentTenant && (
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white dark:bg-gray-900 rounded-lg shadow-sm">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle>{currentTenant.name}</CardTitle>
                  <CardDescription>
                    Tenant ID: {currentTenant.id} • Plan: {currentTenant.plan || 'Enterprise'}
                  </CardDescription>
                </div>
              </div>
              <Badge variant={currentTenant.status === 'active' ? 'default' : 'secondary'}>
                {currentTenant.status}
              </Badge>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">
            <Activity className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="team">
            <Users className="w-4 h-4 mr-2" />
            Team
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="billing">
            <CreditCard className="w-4 h-4 mr-2" />
            Billing
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Signals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {mockUsageMetrics.signals.current.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">
                  of {mockUsageMetrics.signals.limit.toLocaleString()} limit
                </div>
                <div className="mt-2 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${mockUsageMetrics.signals.percentage}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Rules</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {mockUsageMetrics.rules.current}
                </div>
                <div className="text-xs text-gray-500">
                  of {mockUsageMetrics.rules.limit} limit
                </div>
                <div className="mt-2 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full"
                    style={{ width: `${mockUsageMetrics.rules.percentage}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Storage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {mockUsageMetrics.storage.current} {mockUsageMetrics.storage.unit}
                </div>
                <div className="text-xs text-gray-500">
                  of {mockUsageMetrics.storage.limit} {mockUsageMetrics.storage.unit} limit
                </div>
                <div className="mt-2 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${mockUsageMetrics.storage.percentage}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">API Calls</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(mockUsageMetrics.apiCalls.current / 1000).toFixed(1)}K
                </div>
                <div className="text-xs text-gray-500">
                  of {mockUsageMetrics.apiCalls.limit / 1000}K limit
                </div>
                <div className="mt-2 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-amber-500 h-2 rounded-full"
                    style={{ width: `${mockUsageMetrics.apiCalls.percentage}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-500">Organization Name</Label>
                  <p className="font-medium">{currentTenant?.name || 'Acme Corp'}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Industry</Label>
                  <p className="font-medium">Technology</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Created Date</Label>
                  <p className="font-medium">{format(new Date('2023-01-15'), 'MMM d, yyyy')}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Primary Contact</Label>
                  <p className="font-medium">admin@company.com</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Team Members</CardTitle>
                <Button onClick={() => setShowAddUserDialog(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Invite Member
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockTeamMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{member.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={member.status === 'Active' ? 'default' : 'secondary'}
                        >
                          {member.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {member.lastLogin
                          ? format(new Date(member.lastLogin), 'MMM d, h:mm a')
                          : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input id="org-name" defaultValue={currentTenant?.name || 'Acme Corp'} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-website">Website</Label>
                <div className="flex gap-2">
                  <Globe className="w-5 h-5 text-gray-500 mt-2" />
                  <Input id="org-website" defaultValue="https://company.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-phone">Phone</Label>
                <div className="flex gap-2">
                  <Phone className="w-5 h-5 text-gray-500 mt-2" />
                  <Input id="org-phone" defaultValue="+1 (555) 123-4567" />
                </div>
              </div>
              <Button>Save Changes</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-gray-500">Receive alerts via email</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Webhook Notifications</p>
                  <p className="text-sm text-gray-500">Send alerts to webhook endpoints</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Daily Digest</p>
                  <p className="text-sm text-gray-500">Receive daily summary emails</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>API Keys</CardTitle>
                <Button>
                  <Key className="w-4 h-4 mr-2" />
                  Generate New Key
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockApiKeys.map((apiKey) => (
                    <TableRow key={apiKey.id}>
                      <TableCell className="font-medium">{apiKey.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                            {apiKey.key.substring(0, 20)}...
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyApiKey(apiKey.key)}
                          >
                            {copiedApiKey ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>{format(new Date(apiKey.createdAt), 'MMM d, yyyy')}</TableCell>
                      <TableCell>{format(new Date(apiKey.lastUsed), 'MMM d, h:mm a')}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {apiKey.permissions.map((perm) => (
                            <Badge key={perm} variant="secondary" className="text-xs">
                              {perm}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-gray-500">Require 2FA for all team members</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">IP Allowlist</p>
                  <p className="text-sm text-gray-500">Restrict access to specific IP ranges</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Session Timeout</p>
                  <p className="text-sm text-gray-500">Auto-logout after inactivity</p>
                </div>
                <Select defaultValue="30">
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Current Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <div>
                  <h3 className="text-lg font-semibold">Enterprise Plan</h3>
                  <p className="text-sm text-gray-500">Unlimited signals, premium support</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">$999</p>
                  <p className="text-sm text-gray-500">per month</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="outline">Change Plan</Button>
                <Button variant="outline">View Invoice</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 p-4 border rounded-lg">
                <CreditCard className="w-8 h-8 text-gray-500" />
                <div className="flex-1">
                  <p className="font-medium">Visa ending in 4242</p>
                  <p className="text-sm text-gray-500">Expires 12/2025</p>
                </div>
                <Button variant="outline" size="sm">Update</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add User Dialog */}
      <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to add a new member to your team
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" placeholder="colleague@company.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUserDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowAddUserDialog(false)}>Send Invitation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}