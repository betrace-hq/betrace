import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  User,
  Clock,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  FileText,
  Shield,
  Activity,
  Users,
  ChevronDown,
  ChevronUp,
  Send,
  Paperclip,
  Tag,
  GitBranch
} from 'lucide-react'

export interface TimelineEvent {
  id: string
  type: 'status_change' | 'note_added' | 'assignment' | 'escalation' | 'evidence' | 'action'
  title: string
  description?: string
  author: {
    id: string
    name: string
    avatar?: string
    role?: string
  }
  timestamp: string
  metadata?: {
    previousStatus?: string
    newStatus?: string
    assignee?: string
    priority?: string
    tags?: string[]
    attachments?: Array<{
      id: string
      name: string
      size: number
      type: string
    }>
  }
  children?: TimelineEvent[]
}

interface InvestigationTimelineProps {
  events: TimelineEvent[]
  onAddNote?: (note: string, type: 'note' | 'finding' | 'action') => void
  onAssignTo?: (userId: string) => void
  onEscalate?: () => void
  canEdit?: boolean
}

export function InvestigationTimeline({
  events = [],
  onAddNote,
  onAssignTo,
  onEscalate,
  canEdit = true
}: InvestigationTimelineProps) {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())
  const [newNote, setNewNote] = useState('')
  const [noteType, setNoteType] = useState<'note' | 'finding' | 'action'>('note')
  const [showAddNote, setShowAddNote] = useState(false)

  const toggleEventExpansion = (eventId: string) => {
    const newExpanded = new Set(expandedEvents)
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId)
    } else {
      newExpanded.add(eventId)
    }
    setExpandedEvents(newExpanded)
  }

  const handleAddNote = () => {
    if (newNote.trim() && onAddNote) {
      onAddNote(newNote.trim(), noteType)
      setNewNote('')
      setShowAddNote(false)
    }
  }

  const getEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'status_change':
        return <Activity className="w-4 h-4" />
      case 'note_added':
        return <MessageSquare className="w-4 h-4" />
      case 'assignment':
        return <User className="w-4 h-4" />
      case 'escalation':
        return <AlertCircle className="w-4 h-4" />
      case 'evidence':
        return <Paperclip className="w-4 h-4" />
      case 'action':
        return <Shield className="w-4 h-4" />
      default:
        return <FileText className="w-4 h-4" />
    }
  }

  const getEventColor = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'status_change':
        return 'bg-blue-500'
      case 'note_added':
        return 'bg-gray-500'
      case 'assignment':
        return 'bg-purple-500'
      case 'escalation':
        return 'bg-red-500'
      case 'evidence':
        return 'bg-green-500'
      case 'action':
        return 'bg-amber-500'
      default:
        return 'bg-gray-400'
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60))
      return `${diffMins} minutes ago`
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`
    } else {
      return date.toLocaleString()
    }
  }

  return (
    <div className="space-y-4">
      {/* Quick Actions Bar */}
      {canEdit && (
        <div className="flex gap-2 mb-4">
          <Button
            onClick={() => setShowAddNote(!showAddNote)}
            size="sm"
            variant={showAddNote ? "secondary" : "outline"}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Add Note
          </Button>
          <Button
            onClick={onEscalate}
            size="sm"
            variant="outline"
          >
            <AlertCircle className="w-4 h-4 mr-2" />
            Escalate
          </Button>
          <Button
            size="sm"
            variant="outline"
          >
            <Users className="w-4 h-4 mr-2" />
            Assign Team
          </Button>
          <Button
            size="sm"
            variant="outline"
          >
            <Paperclip className="w-4 h-4 mr-2" />
            Add Evidence
          </Button>
        </div>
      )}

      {/* Add Note Form */}
      {showAddNote && canEdit && (
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-4">
            <div className="space-y-3">
              <div className="flex gap-2">
                <Select value={noteType} onValueChange={(value: any) => setNoteType(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="note">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-3 h-3" />
                        Note
                      </div>
                    </SelectItem>
                    <SelectItem value="finding">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3 h-3" />
                        Finding
                      </div>
                    </SelectItem>
                    <SelectItem value="action">
                      <div className="flex items-center gap-2">
                        <Shield className="w-3 h-3" />
                        Action
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost">
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost">
                    <Tag className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder={`Add a ${noteType}...`}
                className="min-h-[80px]"
              />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowAddNote(false)
                    setNewNote('')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Add {noteType}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500 opacity-20"></div>

        {/* Timeline events */}
        <div className="space-y-4">
          {events.map((event, index) => {
            const isExpanded = expandedEvents.has(event.id)
            const hasChildren = event.children && event.children.length > 0

            return (
              <div key={event.id} className="relative">
                {/* Event dot */}
                <div className={`absolute left-4 w-4 h-4 rounded-full ${getEventColor(event.type)} ring-4 ring-white dark:ring-slate-800 z-10`}></div>

                {/* Event content */}
                <div className="ml-12">
                  <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${getEventColor(event.type)} bg-opacity-10`}>
                            {getEventIcon(event.type)}
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm">{event.title}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500">
                                {event.author.name}
                              </span>
                              {event.author.role && (
                                <Badge variant="outline" className="text-xs py-0">
                                  {event.author.role}
                                </Badge>
                              )}
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTime(event.timestamp)}
                              </span>
                            </div>
                          </div>
                        </div>
                        {hasChildren && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleEventExpansion(event.id)}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </CardHeader>

                    {(event.description || event.metadata) && (
                      <CardContent className="pt-0">
                        {event.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {event.description}
                          </p>
                        )}

                        {event.metadata && (
                          <div className="mt-3 space-y-2">
                            {event.metadata.previousStatus && event.metadata.newStatus && (
                              <div className="flex items-center gap-2 text-xs">
                                <Badge variant="outline">{event.metadata.previousStatus}</Badge>
                                <GitBranch className="w-3 h-3 rotate-90 text-gray-400" />
                                <Badge>{event.metadata.newStatus}</Badge>
                              </div>
                            )}

                            {event.metadata.tags && (
                              <div className="flex flex-wrap gap-1">
                                {event.metadata.tags.map((tag, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {event.metadata.attachments && (
                              <div className="flex flex-wrap gap-2">
                                {event.metadata.attachments.map((attachment) => (
                                  <div
                                    key={attachment.id}
                                    className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs"
                                  >
                                    <Paperclip className="w-3 h-3" />
                                    <span>{attachment.name}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    )}

                    {/* Nested events */}
                    {hasChildren && isExpanded && (
                      <CardContent className="pt-0">
                        <div className="pl-4 border-l-2 border-gray-200 dark:border-gray-700 space-y-2">
                          {event.children!.map((child) => (
                            <div key={child.id} className="ml-2">
                              <div className="flex items-start gap-2">
                                <div className={`p-1 rounded ${getEventColor(child.type)} bg-opacity-10 mt-0.5`}>
                                  {getEventIcon(child.type)}
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{child.title}</p>
                                  {child.description && (
                                    <p className="text-xs text-gray-500 mt-1">{child.description}</p>
                                  )}
                                  <p className="text-xs text-gray-400 mt-1">
                                    {child.author.name} • {formatTime(child.timestamp)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}