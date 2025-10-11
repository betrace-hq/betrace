import * as React from 'react'
import { CheckCircle2, X, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export interface SignalActionsProps {
  /**
   * Current signal status
   */
  status: 'open' | 'investigating' | 'resolved' | 'false-positive'

  /**
   * Whether user can modify the signal
   */
  canEdit?: boolean

  /**
   * Callback when status changes
   */
  onStatusChange?: (action: 'investigate' | 'resolve' | 'false_positive') => void

  /**
   * Callback when note is added
   */
  onAddNote?: (note: string) => void

  /**
   * Loading state for actions
   */
  isLoading?: boolean
}

export function SignalActions({
  status,
  canEdit = false,
  onStatusChange,
  onAddNote,
  isLoading = false,
}: SignalActionsProps) {
  const [note, setNote] = React.useState('')

  const handleAddNote = () => {
    if (note.trim() && onAddNote) {
      onAddNote(note.trim())
      setNote('')
    }
  }

  if (!canEdit) {
    return (
      <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          You don't have permission to modify this signal
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Status Change Actions */}
      {status === 'open' && (
        <>
          <Button
            onClick={() => onStatusChange?.('investigate')}
            className="w-full"
            disabled={isLoading}
          >
            <AlertCircle className="w-4 h-4 mr-2" />
            Start Investigation
          </Button>
          <Button
            onClick={() => onStatusChange?.('false_positive')}
            className="w-full"
            variant="outline"
            disabled={isLoading}
          >
            <X className="w-4 h-4 mr-2" />
            Mark False Positive
          </Button>
        </>
      )}

      {status === 'investigating' && (
        <>
          <Button
            onClick={() => onStatusChange?.('resolve')}
            className="w-full"
            disabled={isLoading}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Mark as Resolved
          </Button>
          <Button
            onClick={() => onStatusChange?.('false_positive')}
            className="w-full"
            variant="outline"
            disabled={isLoading}
          >
            <X className="w-4 h-4 mr-2" />
            Mark False Positive
          </Button>
        </>
      )}

      {(status === 'resolved' || status === 'false-positive') && (
        <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg">
          <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Signal {status === 'resolved' ? 'resolved' : 'marked as false positive'}
          </p>
        </div>
      )}

      {/* Quick Note */}
      {status !== 'resolved' && status !== 'false-positive' && (
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Quick Add Note</h4>
          <Textarea
            placeholder="Add investigation note..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="text-sm"
          />
          <Button
            onClick={handleAddNote}
            size="sm"
            className="w-full"
            disabled={!note.trim() || isLoading}
          >
            Add Note
          </Button>
        </div>
      )}
    </div>
  )
}
