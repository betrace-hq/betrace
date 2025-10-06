import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  CheckSquare,
  Square,
  MoreHorizontal,
  CheckCircle,
  Clock,
  X,
  AlertTriangle,
  Trash2,
  Archive,
  Tag,
  UserCheck
} from 'lucide-react'
import { DemoSignal } from '@/lib/api/demo-api'

interface BulkActionsProps {
  signals: DemoSignal[]
  selectedSignals: string[]
  onSelectionChange: (signalIds: string[]) => void
  onBulkAction: (action: string, signalIds: string[]) => void
  canAccess: (permission: string) => boolean
  className?: string
}

export function BulkActions({
  signals,
  selectedSignals,
  onSelectionChange,
  onBulkAction,
  canAccess,
  className
}: BulkActionsProps) {
  const [bulkAction, setBulkAction] = useState<string>('')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [actionInProgress, setActionInProgress] = useState(false)

  const allSelected = selectedSignals.length === signals.length && signals.length > 0
  const someSelected = selectedSignals.length > 0 && selectedSignals.length < signals.length
  const noneSelected = selectedSignals.length === 0

  const bulkActions = [
    {
      value: 'investigate',
      label: 'Mark as Investigating',
      icon: Clock,
      description: 'Start investigation on selected signals',
      requiresPermission: 'signals:write',
      color: 'amber'
    },
    {
      value: 'resolve',
      label: 'Mark as Resolved',
      icon: CheckCircle,
      description: 'Mark selected signals as resolved',
      requiresPermission: 'signals:write',
      color: 'green'
    },
    {
      value: 'false_positive',
      label: 'Mark as False Positive',
      icon: X,
      description: 'Mark selected signals as false positives',
      requiresPermission: 'signals:write',
      color: 'gray'
    },
    {
      value: 'assign',
      label: 'Assign to Team Member',
      icon: UserCheck,
      description: 'Assign selected signals to a team member',
      requiresPermission: 'signals:write',
      color: 'blue'
    },
    {
      value: 'archive',
      label: 'Archive',
      icon: Archive,
      description: 'Archive selected signals',
      requiresPermission: 'signals:write',
      color: 'purple'
    },
    {
      value: 'delete',
      label: 'Delete',
      icon: Trash2,
      description: 'Permanently delete selected signals',
      requiresPermission: 'signals:delete',
      color: 'red',
      dangerous: true
    }
  ]

  const availableActions = bulkActions.filter(action => canAccess(action.requiresPermission))

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectionChange([])
    } else {
      onSelectionChange(signals.map(signal => signal.id))
    }
  }

  const handleBulkActionSelect = (actionValue: string) => {
    setBulkAction(actionValue)
    setShowConfirmDialog(true)
  }

  const handleConfirmAction = async () => {
    if (!bulkAction || selectedSignals.length === 0) return

    setActionInProgress(true)

    try {
      await onBulkAction(bulkAction, selectedSignals)
      onSelectionChange([]) // Clear selection after action
      setBulkAction('')
      setShowConfirmDialog(false)
    } catch (error) {
      console.error('Bulk action failed:', error)
    } finally {
      setActionInProgress(false)
    }
  }

  const selectedAction = bulkActions.find(action => action.value === bulkAction)

  if (signals.length === 0) {
    return null
  }

  return (
    <>
      <div className={`flex items-center gap-3 ${className}`}>
        {/* Select All Checkbox */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSelectAll}
            className="flex items-center justify-center w-5 h-5 border border-gray-300 dark:border-gray-600 rounded transition-colors hover:border-gray-400 dark:hover:border-gray-500"
          >
            {allSelected ? (
              <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            ) : someSelected ? (
              <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-sm" />
            ) : (
              <Square className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            )}
          </button>

          {selectedSignals.length > 0 && (
            <Badge variant="secondary" className="px-2 py-1 text-xs">
              {selectedSignals.length} selected
            </Badge>
          )}
        </div>

        {/* Bulk Actions Dropdown */}
        {selectedSignals.length > 0 && (
          <div className="flex items-center gap-2">
            <Select value="" onValueChange={handleBulkActionSelect}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Bulk actions..." />
              </SelectTrigger>
              <SelectContent>
                {availableActions.map(action => {
                  const Icon = action.icon
                  return (
                    <SelectItem key={action.value} value={action.value}>
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${
                          action.dangerous ? 'text-red-500' :
                          action.color === 'amber' ? 'text-amber-500' :
                          action.color === 'green' ? 'text-green-500' :
                          action.color === 'blue' ? 'text-blue-500' :
                          action.color === 'purple' ? 'text-purple-500' :
                          'text-gray-500'
                        }`} />
                        <div>
                          <div className="font-medium">{action.label}</div>
                          <div className="text-xs text-gray-500">{action.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelectionChange([])}
            >
              Clear Selection
            </Button>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedAction?.dangerous ? (
                <div className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="w-5 h-5" />
                  Confirm Bulk Action
                </div>
              ) : (
                'Confirm Bulk Action'
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedAction && (
                <div className="space-y-2">
                  <p>
                    You are about to <strong>{selectedAction.label.toLowerCase()}</strong> on{' '}
                    <strong>{selectedSignals.length}</strong> signal{selectedSignals.length > 1 ? 's' : ''}.
                  </p>

                  {selectedAction.dangerous && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <div className="flex items-center gap-2 text-red-800 dark:text-red-400">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="font-medium">Warning: This action cannot be undone!</span>
                      </div>
                    </div>
                  )}

                  <p className="text-sm text-gray-500">
                    {selectedAction.description}
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              disabled={actionInProgress}
              className={selectedAction?.dangerous ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {actionInProgress ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                `${selectedAction?.label} (${selectedSignals.length})`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}