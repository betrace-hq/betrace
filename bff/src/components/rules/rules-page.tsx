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
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SortableColumn, type SortDirection } from '@/components/ui/sortable-column'
import { useRules, useCreateRule, useUpdateRule, useDeleteRule, useActivateRule, useDeactivateRule } from '@/lib/hooks/use-rules'
import { useAuth } from '@/lib/auth/auth-context'
import { Layout } from '@/components/layout/layout'
import { LoadingState } from '@/components/ui/loading-state'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import { Plus, Search, Play, Pause, Edit, Trash2, AlertCircle } from 'lucide-react'
import { RuleForm } from './rule-form'

export function RulesPage() {
  const navigate = useNavigate()
  const { canAccess } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<any>(null)
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  // Fetch rules
  const { data: rules, isLoading, error } = useRules()

  // Mutations for rule actions
  const createRule = useCreateRule()
  const updateRule = useUpdateRule()
  const deleteRule = useDeleteRule()
  const activateRule = useActivateRule()
  const deactivateRule = useDeactivateRule()

  // Sort handler
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Cycle through: null -> asc -> desc -> null
      if (sortDirection === null) {
        setSortDirection('asc')
      } else if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else {
        setSortDirection(null)
        setSortColumn(null)
      }
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  // Filter and sort rules
  const filteredRules = ((rules || []) as any[])
    .filter((rule: any) =>
      rule.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.expression?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a: any, b: any) => {
      if (!sortColumn || !sortDirection) return 0

      const getValue = (rule: any, column: string) => {
        switch (column) {
          case 'name':
            return rule.name || ''
          case 'severity':
            const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
            return severityOrder[rule.severity as keyof typeof severityOrder] || 0
          case 'status':
            return rule.active ? 1 : 0
          default:
            return ''
        }
      }

      const aVal = getValue(a, sortColumn)
      const bVal = getValue(b, sortColumn)

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

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
    return <LoadingState fullScreen message="Loading rules..." />
  }

  if (error) {
    return (
      <ErrorState
        fullScreen
        title="Error Loading Rules"
        message="Failed to load rules. Please try again."
        onRetry={() => window.location.reload()}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Create Button */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Behavioral Rules
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Define and manage rules for monitoring service behavior
            </p>
          </div>
          {canAccess('rules:write') && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Rule
                </Button>
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

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search rules..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Rules Table */}
        <Card className="py-0">
          <CardContent className="p-0">
            {filteredRules.length === 0 ? (
              <EmptyState
                icon={AlertCircle}
                title="No rules found"
                description={
                  searchTerm
                    ? 'Try adjusting your search to see more results.'
                    : 'Create your first rule to start monitoring your services.'
                }
              >
                {canAccess('rules:write') && !searchTerm && (
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Rule
                  </Button>
                )}
              </EmptyState>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-gray-800">
                    <SortableColumn
                      sortDirection={sortColumn === 'name' ? sortDirection : null}
                      onSort={() => handleSort('name')}
                    >
                      Rule
                    </SortableColumn>
                    <SortableColumn
                      sortDirection={sortColumn === 'severity' ? sortDirection : null}
                      onSort={() => handleSort('severity')}
                      className="w-32"
                    >
                      Severity
                    </SortableColumn>
                    <SortableColumn
                      sortDirection={sortColumn === 'status' ? sortDirection : null}
                      onSort={() => handleSort('status')}
                      className="w-24"
                    >
                      Status
                    </SortableColumn>
                    <SortableColumn sortable={false} className="w-32 text-right">
                      Actions
                    </SortableColumn>
                  </TableRow>
                </TableHeader>
                  <TableBody>
                    {filteredRules.map((rule, index) => (
                      <TableRow key={rule.id} className={index !== filteredRules.length - 1 ? "border-b border-gray-200 dark:border-gray-700" : ""}>
                        <TableCell className="py-4">
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white mb-1">
                              {rule.name}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              {rule.description}
                            </div>
                            <code className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded font-mono">
                              {rule.expression}
                            </code>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 align-top">
                          {rule.severity === 'CRITICAL' && (
                            <Badge className="bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700">
                              Critical
                            </Badge>
                          )}
                          {rule.severity === 'HIGH' && (
                            <Badge className="bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700">
                              High
                            </Badge>
                          )}
                          {rule.severity === 'MEDIUM' && (
                            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700">
                              Medium
                            </Badge>
                          )}
                          {rule.severity === 'LOW' && (
                            <Badge className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700">
                              Low
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-4 align-top">
                          {rule.active ? (
                            <Badge className="bg-green-600 text-white border-green-700 inline-flex items-center gap-1">
                              <Play className="w-3 h-3" />
                              Active
                            </Badge>
                          ) : (
                            <Badge className="bg-gray-500 text-white border-gray-600 inline-flex items-center gap-1">
                              <Pause className="w-3 h-3" />
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-4 align-top">
                          <div className="flex items-center justify-end gap-1">
                            {canAccess('rules:write') && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleToggleRule(rule)}
                                  disabled={activateRule.isPending || deactivateRule.isPending}
                                >
                                  {rule.active ? (
                                    <Pause className="w-4 h-4" />
                                  ) : (
                                    <Play className="w-4 h-4" />
                                  )}
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingRule(rule)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 dark:text-red-400"
                                  onClick={() => handleDeleteRule(rule.id)}
                                  disabled={deleteRule.isPending}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
            )}
          </CardContent>
        </Card>
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
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