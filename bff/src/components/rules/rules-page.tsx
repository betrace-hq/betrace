import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useRules, useCreateRule, useUpdateRule, useDeleteRule, useActivateRule, useDeactivateRule } from '@/lib/hooks/use-rules'
import { useAuth } from '@/lib/auth/auth-context'
import { Layout } from '@/components/layout/layout'
import { Plus, Search, Play, Pause, Edit, Trash2, AlertCircle } from 'lucide-react'
import { RuleForm } from './rule-form'

export function RulesPage() {
  const navigate = useNavigate()
  const { canAccess } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<any>(null)

  // Fetch rules
  const { data: rules, isLoading, error } = useRules()

  // Mutations for rule actions
  const createRule = useCreateRule()
  const updateRule = useUpdateRule()
  const deleteRule = useDeleteRule()
  const activateRule = useActivateRule()
  const deactivateRule = useDeactivateRule()

  // Filter rules based on search term
  const filteredRules = rules?.filter((rule) =>
    rule.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.expression?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  const handleCreateRule = async (ruleData: any) => {
    try {
      await createRule.mutateAsync(ruleData)
      setIsCreateDialogOpen(false)
    } catch (error) {
      console.error('Failed to create rule:', error)
      alert('Failed to create rule. Please try again.')
    }
  }

  const handleUpdateRule = async (ruleData: any) => {
    if (!editingRule) return

    try {
      await updateRule.mutateAsync({
        id: editingRule.id,
        ruleData,
      })
      setEditingRule(null)
    } catch (error) {
      console.error('Failed to update rule:', error)
      alert('Failed to update rule. Please try again.')
    }
  }

  const handleToggleRule = async (rule: any) => {
    if (!canAccess('rules:write')) {
      alert('You do not have permission to modify rules')
      return
    }

    try {
      if (rule.active) {
        await deactivateRule.mutateAsync(rule.id)
      } else {
        await activateRule.mutateAsync(rule.id)
      }
    } catch (error) {
      console.error('Failed to toggle rule:', error)
      alert('Failed to toggle rule status. Please try again.')
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    if (!canAccess('rules:write')) {
      alert('You do not have permission to delete rules')
      return
    }

    if (!confirm('Are you sure you want to delete this rule? This action cannot be undone.')) {
      return
    }

    try {
      await deleteRule.mutateAsync(ruleId)
    } catch (error) {
      console.error('Failed to delete rule:', error)
      alert('Failed to delete rule. Please try again.')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading rules...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Error Loading Rules</h2>
          <p className="text-gray-600 mb-4">Failed to load rules. Please try again.</p>
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/50 to-purple-100/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 relative overflow-hidden">
      {/* Enhanced background elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Subtle gradient orbs */}
        <div className="absolute -top-40 -right-32 w-[400px] h-[400px] bg-gradient-to-br from-blue-500/20 to-cyan-400/10 rounded-full blur-3xl animate-pulse opacity-60"></div>
        <div className="absolute -bottom-40 -left-32 w-[500px] h-[500px] bg-gradient-to-tr from-purple-500/15 to-pink-400/10 rounded-full blur-3xl animate-pulse delay-1000 opacity-50"></div>
        <div className="absolute top-1/3 right-1/4 w-[250px] h-[250px] bg-gradient-to-r from-emerald-400/15 to-teal-300/10 rounded-full blur-3xl animate-pulse delay-2000 opacity-40"></div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.04),transparent_70%)]"></div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Enhanced Create Rule Button */}
        <div className="flex justify-end mb-6">
          {canAccess('rules:write') && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-300"></div>
                  <Button className="relative px-8 py-4 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-600 hover:from-emerald-600 hover:via-blue-600 hover:to-purple-700 text-white border-0 shadow-xl hover:shadow-emerald-500/30 transition-all duration-300 rounded-2xl font-bold text-lg group-hover:scale-105">
                    <Plus className="w-5 h-5 mr-3" />
                    Create New Rule
                  </Button>
                </div>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900">
                    <DialogHeader>
                      <DialogTitle>Create New Rule</DialogTitle>
                      <DialogDescription>
                        Create a new behavioral assurance rule using OGNL expressions.
                      </DialogDescription>
                    </DialogHeader>
                    <RuleForm
                      onSubmit={handleCreateRule}
                      onCancel={() => setIsCreateDialogOpen(false)}
                      isLoading={createRule.isPending}
                    />
                  </DialogContent>
                </Dialog>
              )}
        </div>
        {/* Enhanced Search */}
        <div className="relative group mb-6">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-3xl blur-lg opacity-10 group-hover:opacity-20 transition duration-300"></div>
          <Card className="relative bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 rounded-3xl">
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                <Input
                  placeholder="Search rules by name, description, or expression..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 py-4 text-lg bg-white/50 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-600/50 rounded-2xl focus:ring-2 focus:ring-blue-500/50 transition-all duration-300"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Rules Table */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 rounded-3xl blur-lg opacity-10 group-hover:opacity-20 transition duration-300"></div>
          <Card className="relative bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 rounded-3xl">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-2xl font-black text-slate-900 dark:text-white">
                <div className="p-2 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 rounded-2xl">
                  <AlertCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                Behavioral Rules ({filteredRules.length})
              </CardTitle>
            </CardHeader>
          <CardContent>
            {filteredRules.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No rules found</h3>
                <p className="text-gray-600 mb-4">
                  {searchTerm
                    ? 'Try adjusting your search to see more results.'
                    : 'Create your first rule to start monitoring your services.'}
                </p>
                {canAccess('rules:write') && !searchTerm && (
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Rule
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                      <TableHead className="h-10 px-3 text-left align-middle font-medium text-slate-900 dark:text-white text-xs border-r border-slate-200 dark:border-slate-700 last:border-r-0 w-20">
                        Status
                      </TableHead>
                      <TableHead className="h-10 px-3 text-left align-middle font-medium text-slate-900 dark:text-white text-xs border-r border-slate-200 dark:border-slate-700 last:border-r-0">
                        Name
                      </TableHead>
                      <TableHead className="h-10 px-3 text-left align-middle font-medium text-slate-900 dark:text-white text-xs border-r border-slate-200 dark:border-slate-700 last:border-r-0">
                        Description
                      </TableHead>
                      <TableHead className="h-10 px-3 text-left align-middle font-medium text-slate-900 dark:text-white text-xs border-r border-slate-200 dark:border-slate-700 last:border-r-0">
                        Severity
                      </TableHead>
                      <TableHead className="h-10 px-3 text-left align-middle font-medium text-slate-900 dark:text-white text-xs border-r border-slate-200 dark:border-slate-700 last:border-r-0">
                        Expression
                      </TableHead>
                      <TableHead className="h-10 px-3 text-left align-middle font-medium text-slate-900 dark:text-white text-xs border-r border-slate-200 dark:border-slate-700 last:border-r-0">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRules.map((rule) => (
                      <TableRow
                        key={rule.id}
                        className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-200 last:border-b-0"
                      >
                        <TableCell className="h-12 px-3 align-middle border-r border-slate-200 dark:border-slate-700 last:border-r-0 w-20">
                          {rule.active ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-600 text-white font-medium px-2 py-0.5 rounded text-xs">
                              <Play className="w-3 h-3" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-slate-500 text-white font-medium px-2 py-0.5 rounded text-xs">
                              <Pause className="w-3 h-3" />
                              Inactive
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="h-12 px-3 align-middle border-r border-slate-200 dark:border-slate-700 last:border-r-0">
                          <div className="text-sm font-medium text-slate-900 dark:text-white">{rule.name}</div>
                        </TableCell>
                        <TableCell className="px-3 align-middle border-r border-slate-200 dark:border-slate-700 last:border-r-0 max-w-xs">
                          <div className="text-sm text-slate-700 dark:text-slate-300 break-words">
                            {rule.description}
                          </div>
                        </TableCell>
                        <TableCell className="h-12 px-3 align-middle border-r border-slate-200 dark:border-slate-700 last:border-r-0">
                          {rule.severity === 'CRITICAL' ? (
                            <span className="bg-red-100 text-red-800 border border-red-200 font-medium px-1.5 py-0.5 rounded text-xs">
                              Critical
                            </span>
                          ) : rule.severity === 'HIGH' ? (
                            <span className="bg-orange-100 text-orange-800 border border-orange-200 font-medium px-1.5 py-0.5 rounded text-xs">
                              High
                            </span>
                          ) : rule.severity === 'MEDIUM' ? (
                            <span className="bg-yellow-100 text-yellow-800 border border-yellow-200 font-medium px-1.5 py-0.5 rounded text-xs">
                              Medium
                            </span>
                          ) : (
                            <span className="bg-blue-100 text-blue-800 border border-blue-200 font-medium px-1.5 py-0.5 rounded text-xs">
                              Low
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="px-3 align-middle border-r border-slate-200 dark:border-slate-700 last:border-r-0 max-w-sm">
                          <code className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded block border border-slate-200 dark:border-slate-600 whitespace-pre-wrap break-words">
                            {rule.expression}
                          </code>
                        </TableCell>
                        <TableCell className="h-12 px-3 align-middle border-r border-slate-200 dark:border-slate-700 last:border-r-0">
                          <div className="flex items-center gap-1">
                            {canAccess('rules:write') && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2"
                                  onClick={() => handleToggleRule(rule)}
                                  disabled={activateRule.isPending || deactivateRule.isPending}
                                >
                                  {rule.active ? (
                                    <Pause className="w-3 h-3" />
                                  ) : (
                                    <Play className="w-3 h-3" />
                                  )}
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2"
                                  onClick={() => setEditingRule(rule)}
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2"
                                  onClick={() => handleDeleteRule(rule.id)}
                                  disabled={deleteRule.isPending}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
          </Card>
        </div>
      </main>

      {/* Edit Rule Dialog */}
      {editingRule && (
        <Dialog open={true} onOpenChange={() => setEditingRule(null)}>
          <DialogContent className="max-w-2xl bg-white dark:bg-slate-900">
            <DialogHeader>
              <DialogTitle>Edit Rule</DialogTitle>
              <DialogDescription>
                Update the behavioral assurance rule configuration.
              </DialogDescription>
            </DialogHeader>
            <RuleForm
              initialData={editingRule}
              onSubmit={handleUpdateRule}
              onCancel={() => setEditingRule(null)}
              isLoading={updateRule.isPending}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export function RulesPageWithAuth() {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: '/auth' })
    }
  }, [isAuthenticated, isLoading, navigate])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <Layout>
      <RulesPage />
    </Layout>
  )
}