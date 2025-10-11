import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Users,
  MessageCircle,
  Share2,
  UserPlus,
  Bell,
  Clock,
  CheckCircle,
  AlertTriangle,
  Send,
  Plus,
  Edit,
  Trash2,
  Eye,
  FileText,
  Calendar,
  Tag,
  Filter,
  Search,
  MoreHorizontal,
  Pin,
  Archive,
  Star,
  Hash,
  Paperclip,
  Download,
  Activity,
  Shield,
  Target,
  X
} from 'lucide-react'
import { DemoSignal } from '@/lib/api/demo-api'

interface SignalCollaborationProps {
  signal?: DemoSignal
  className?: string
}

interface TeamMember {
  id: string
  name: string
  email: string
  role: 'analyst' | 'lead' | 'manager' | 'admin'
  avatar?: string
  status: 'online' | 'away' | 'offline'
  expertise: string[]
  last_active: string
}

interface Comment {
  id: string
  author: TeamMember
  content: string
  timestamp: string
  type: 'comment' | 'status_change' | 'assignment' | 'escalation'
  attachments?: Attachment[]
  mentions?: string[]
  edited?: boolean
  reactions?: Reaction[]
}

interface Attachment {
  id: string
  name: string
  size: number
  type: 'image' | 'document' | 'log' | 'screenshot'
  url: string
  uploaded_by: string
  uploaded_at: string
}

interface Reaction {
  emoji: string
  users: string[]
  count: number
}

interface Assignment {
  id: string
  signal_id: string
  assignee: TeamMember
  assigned_by: TeamMember
  assigned_at: string
  due_date?: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'declined'
  notes?: string
}

interface Collaboration {
  signal_id: string
  team_members: TeamMember[]
  comments: Comment[]
  assignments: Assignment[]
  watchers: string[]
  shared_with: string[]
  tags: string[]
  status: 'open' | 'active' | 'resolved' | 'archived'
}

export function SignalCollaboration({ signal, className }: SignalCollaborationProps) {
  const [activeTab, setActiveTab] = useState('comments')
  const [newComment, setNewComment] = useState('')
  const [selectedAssignee, setSelectedAssignee] = useState<string>('')
  const [isAssigning, setIsAssigning] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState<string>('all')

  // Mock data - in production this would come from API
  const mockTeamMembers: TeamMember[] = [
    {
      id: 'user-1',
      name: 'Sarah Chen',
      email: 'sarah.chen@company.com',
      role: 'lead',
      status: 'online',
      expertise: ['malware-analysis', 'incident-response', 'threat-hunting'],
      last_active: new Date().toISOString(),
      avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b77c?w=32&h=32&fit=crop&crop=face'
    },
    {
      id: 'user-2',
      name: 'Mike Johnson',
      email: 'mike.johnson@company.com',
      role: 'analyst',
      status: 'online',
      expertise: ['network-security', 'forensics', 'pentesting'],
      last_active: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=32&h=32&fit=crop&crop=face'
    },
    {
      id: 'user-3',
      name: 'Alex Rodriguez',
      email: 'alex.rodriguez@company.com',
      role: 'analyst',
      status: 'away',
      expertise: ['data-analysis', 'automation', 'scripting'],
      last_active: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face'
    },
    {
      id: 'user-4',
      name: 'Emma Wilson',
      email: 'emma.wilson@company.com',
      role: 'manager',
      status: 'offline',
      expertise: ['compliance', 'risk-management', 'strategy'],
      last_active: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=32&h=32&fit=crop&crop=face'
    }
  ]

  const [collaboration, setCollaboration] = useState<Collaboration>({
    signal_id: signal?.id || 'demo-signal',
    team_members: mockTeamMembers,
    comments: [
      {
        id: 'comment-1',
        author: mockTeamMembers[0],
        content: 'I\'ve started the initial triage for this signal. Based on the source IP and user behavior patterns, this looks like a potential insider threat scenario.',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        type: 'comment',
        reactions: [
          { emoji: '👍', users: ['user-2', 'user-3'], count: 2 },
          { emoji: '🔍', users: ['user-4'], count: 1 }
        ]
      },
      {
        id: 'comment-2',
        author: mockTeamMembers[1],
        content: 'Agreed. I\'ve pulled additional logs from the network monitoring system. Found some unusual data transfer patterns around the same timeframe. @sarah.chen can you review the user access logs?',
        timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
        type: 'comment',
        mentions: ['user-1'],
        attachments: [
          {
            id: 'attach-1',
            name: 'network_logs_analysis.pdf',
            size: 2457600,
            type: 'document',
            url: '#',
            uploaded_by: 'user-2',
            uploaded_at: new Date(Date.now() - 90 * 60 * 1000).toISOString()
          }
        ]
      },
      {
        id: 'comment-3',
        author: mockTeamMembers[2],
        content: 'I\'ve automated the log correlation process and found 3 similar incidents in the past 30 days. This might be part of a larger pattern.',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        type: 'comment',
        reactions: [
          { emoji: '⚡', users: ['user-1', 'user-2'], count: 2 }
        ]
      }
    ],
    assignments: [
      {
        id: 'assign-1',
        signal_id: signal?.id || 'demo-signal',
        assignee: mockTeamMembers[0],
        assigned_by: mockTeamMembers[3],
        assigned_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        priority: 'high',
        status: 'in_progress',
        notes: 'Primary investigation lead - coordinate with network team'
      },
      {
        id: 'assign-2',
        signal_id: signal?.id || 'demo-signal',
        assignee: mockTeamMembers[1],
        assigned_by: mockTeamMembers[0],
        assigned_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
        priority: 'medium',
        status: 'completed',
        notes: 'Network forensics analysis'
      }
    ],
    watchers: ['user-1', 'user-2', 'user-3', 'user-4'],
    shared_with: ['security-team', 'incident-response'],
    tags: ['insider-threat', 'high-priority', 'network-anomaly', 'data-exfiltration'],
    status: 'active'
  })

  const handleAddComment = () => {
    if (!newComment.trim()) return

    const comment: Comment = {
      id: `comment-${Date.now()}`,
      author: mockTeamMembers[0], // Current user
      content: newComment.trim(),
      timestamp: new Date().toISOString(),
      type: 'comment'
    }

    setCollaboration(prev => ({
      ...prev,
      comments: [...prev.comments, comment]
    }))
    setNewComment('')
  }

  const handleAssignUser = () => {
    if (!selectedAssignee) return

    const assignee = mockTeamMembers.find(m => m.id === selectedAssignee)
    if (!assignee) return

    const assignment: Assignment = {
      id: `assign-${Date.now()}`,
      signal_id: collaboration.signal_id,
      assignee,
      assigned_by: mockTeamMembers[0], // Current user
      assigned_at: new Date().toISOString(),
      priority: 'medium',
      status: 'pending',
      notes: 'Additional analysis required'
    }

    setCollaboration(prev => ({
      ...prev,
      assignments: [...prev.assignments, assignment]
    }))
    setSelectedAssignee('')
    setIsAssigning(false)
  }

  const handleReaction = (commentId: string, emoji: string) => {
    setCollaboration(prev => ({
      ...prev,
      comments: prev.comments.map(comment => {
        if (comment.id !== commentId) return comment

        const reactions = comment.reactions || []
        const existingReaction = reactions.find(r => r.emoji === emoji)

        if (existingReaction) {
          // Toggle reaction
          const hasUserReacted = existingReaction.users.includes('user-1')
          if (hasUserReacted) {
            existingReaction.users = existingReaction.users.filter(u => u !== 'user-1')
            existingReaction.count--
          } else {
            existingReaction.users.push('user-1')
            existingReaction.count++
          }

          return {
            ...comment,
            reactions: reactions.filter(r => r.count > 0)
          }
        } else {
          return {
            ...comment,
            reactions: [...reactions, { emoji, users: ['user-1'], count: 1 }]
          }
        }
      })
    }))
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      online: { className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400', label: 'Online' },
      away: { className: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400', label: 'Away' },
      offline: { className: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400', label: 'Offline' },
    } as const

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.offline

    return (
      <Badge variant="outline" className={`${config.className} text-xs px-2 py-0.5`}>
        {config.label}
      </Badge>
    )
  }

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      admin: { className: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400', label: 'Admin' },
      manager: { className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400', label: 'Manager' },
      lead: { className: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400', label: 'Lead' },
      analyst: { className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400', label: 'Analyst' },
    } as const

    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.analyst

    return (
      <Badge variant="outline" className={`${config.className} text-xs px-2 py-0.5`}>
        {config.label}
      </Badge>
    )
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const date = new Date(timestamp)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const filteredTeamMembers = collaboration.team_members.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         member.expertise.some(skill => skill.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesRole = filterRole === 'all' || member.role === filterRole

    return matchesSearch && matchesRole
  })

  return (
    <Card className={`border-gray-200 dark:border-gray-700 ${className}`}>
      <CardHeader className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
        <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
          <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          Team Collaboration
          <Badge variant="outline" className="ml-auto">
            {collaboration.team_members.length} members
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="comments">
              <MessageCircle className="w-4 h-4 mr-2" />
              Comments ({collaboration.comments.length})
            </TabsTrigger>
            <TabsTrigger value="team">
              <Users className="w-4 h-4 mr-2" />
              Team ({collaboration.team_members.length})
            </TabsTrigger>
            <TabsTrigger value="assignments">
              <Target className="w-4 h-4 mr-2" />
              Tasks ({collaboration.assignments.length})
            </TabsTrigger>
            <TabsTrigger value="sharing">
              <Share2 className="w-4 h-4 mr-2" />
              Sharing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="comments" className="space-y-4">
            {/* Comments Thread */}
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {collaboration.comments.map(comment => (
                <div key={comment.id} className="flex gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={comment.author.avatar} />
                    <AvatarFallback>{comment.author.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 dark:text-white text-sm">
                        {comment.author.name}
                      </span>
                      {getRoleBadge(comment.author.role)}
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTimeAgo(comment.timestamp)}
                      </span>
                      {comment.edited && (
                        <Badge variant="outline" className="text-xs">edited</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                      {comment.content}
                    </p>

                    {/* Attachments */}
                    {comment.attachments && comment.attachments.length > 0 && (
                      <div className="space-y-2 mb-2">
                        {comment.attachments.map(attachment => (
                          <div key={attachment.id} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                            <Paperclip className="w-4 h-4 text-gray-500" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {attachment.name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {formatFileSize(attachment.size)} • {attachment.type}
                              </p>
                            </div>
                            <Button variant="outline" size="sm">
                              <Download className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reactions */}
                    <div className="flex items-center gap-2">
                      {comment.reactions && comment.reactions.map(reaction => (
                        <button
                          key={reaction.emoji}
                          onClick={() => handleReaction(comment.id, reaction.emoji)}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <span>{reaction.emoji}</span>
                          <span className="text-gray-600 dark:text-gray-400">{reaction.count}</span>
                        </button>
                      ))}
                      <button
                        onClick={() => handleReaction(comment.id, '👍')}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                      >
                        <span>👍</span>
                      </button>
                      <button
                        onClick={() => handleReaction(comment.id, '🔍')}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                      >
                        <span>🔍</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Comment */}
            <div className="flex gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback>SC</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <Textarea
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[80px] resize-none"
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Paperclip className="w-4 h-4 mr-1" />
                      Attach
                    </Button>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Use @name to mention team members
                    </span>
                  </div>
                  <Button
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    size="sm"
                  >
                    <Send className="w-4 h-4 mr-1" />
                    Send
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="team" className="space-y-4">
            {/* Team Search and Filters */}
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search team members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="analyst">Analyst</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm">
                <UserPlus className="w-4 h-4 mr-1" />
                Invite
              </Button>
            </div>

            {/* Team Members List */}
            <div className="space-y-3">
              {filteredTeamMembers.map(member => (
                <div key={member.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback>{member.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {member.name}
                      </span>
                      {getRoleBadge(member.role)}
                      {getStatusBadge(member.status)}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      {member.email}
                    </p>
                    <div className="flex items-center gap-1 flex-wrap">
                      {member.expertise.slice(0, 3).map(skill => (
                        <Badge key={skill} variant="secondary" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                      {member.expertise.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{member.expertise.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTimeAgo(member.last_active)}
                    </span>
                    <Button variant="outline" size="sm">
                      <MessageCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="assignments" className="space-y-4">
            {/* Assignment Actions */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Task Assignments</h3>
              <Button
                onClick={() => setIsAssigning(true)}
                size="sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Assign Task
              </Button>
            </div>

            {/* New Assignment Form */}
            {isAssigning && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3">Assign New Task</h4>
                <div className="space-y-3">
                  <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select team member" />
                    </SelectTrigger>
                    <SelectContent>
                      {collaboration.team_members.map(member => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name} ({member.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea placeholder="Assignment notes..." className="min-h-[60px]" />
                  <div className="flex gap-2">
                    <Button onClick={handleAssignUser} size="sm">
                      Assign
                    </Button>
                    <Button
                      onClick={() => setIsAssigning(false)}
                      variant="outline"
                      size="sm"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Assignments List */}
            <div className="space-y-3">
              {collaboration.assignments.map(assignment => (
                <div key={assignment.id} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={assignment.assignee.avatar} />
                        <AvatarFallback>
                          {assignment.assignee.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {assignment.assignee.name}
                        </span>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Assigned by {assignment.assigned_by.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          assignment.priority === 'urgent' ? 'border-red-200 text-red-800 bg-red-50 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' :
                          assignment.priority === 'high' ? 'border-orange-200 text-orange-800 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800' :
                          assignment.priority === 'medium' ? 'border-yellow-200 text-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800' :
                          'border-green-200 text-green-800 bg-green-50 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                        }
                      >
                        {assignment.priority}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          assignment.status === 'completed' ? 'border-green-200 text-green-800 bg-green-50 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' :
                          assignment.status === 'in_progress' ? 'border-blue-200 text-blue-800 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' :
                          assignment.status === 'declined' ? 'border-red-200 text-red-800 bg-red-50 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' :
                          'border-gray-200 text-gray-800 bg-gray-50 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800'
                        }
                      >
                        {assignment.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                  {assignment.notes && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                      {assignment.notes}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Assigned {formatTimeAgo(assignment.assigned_at)}</span>
                    {assignment.due_date && (
                      <span>Due {formatTimeAgo(assignment.due_date)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="sharing" className="space-y-4">
            {/* Sharing Settings */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Signal Sharing</h3>

                {/* Watchers */}
                <div className="mb-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    Watchers ({collaboration.watchers.length})
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Team members who receive notifications for this signal
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {collaboration.watchers.map(watcherId => {
                      const watcher = collaboration.team_members.find(m => m.id === watcherId)
                      return watcher ? (
                        <div key={watcherId} className="flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={watcher.avatar} />
                            <AvatarFallback className="text-xs">
                              {watcher.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {watcher.name}
                          </span>
                          <button className="text-gray-500 hover:text-red-500 transition-colors">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : null
                    })}
                    <Button variant="outline" size="sm">
                      <Plus className="w-3 h-3 mr-1" />
                      Add Watcher
                    </Button>
                  </div>
                </div>

                {/* Shared Groups */}
                <div className="mb-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    Shared with Groups
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Teams and groups with access to this signal
                  </p>
                  <div className="space-y-2">
                    {collaboration.shared_with.map(group => (
                      <div key={group} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {group.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        </div>
                        <Button variant="outline" size="sm">
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="w-full">
                      <Plus className="w-4 h-4 mr-1" />
                      Share with Group
                    </Button>
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    Tags
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Categorize and organize this signal
                  </p>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {collaboration.tags.map(tag => (
                      <div key={tag} className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 rounded-full">
                        <Hash className="w-3 h-3" />
                        <span className="text-sm">{tag}</span>
                        <button className="text-blue-600 hover:text-red-500 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Add tag..." className="flex-1" />
                    <Button size="sm">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}