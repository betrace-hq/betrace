import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Search,
  Filter,
  X,
  Calendar,
  Clock,
  Tag,
  Server,
  User,
  AlertTriangle,
  CheckCircle,
  Target,
  Zap,
  Hash,
  MapPin,
  Globe,
  Shield,
  Eye,
  Save,
  BookOpen,
  RefreshCw
} from 'lucide-react'
import { DemoSignal } from '@/lib/api/demo-api'

interface SearchFilter {
  id: string
  field: string
  operator: string
  value: string | string[]
  label: string
}

interface SavedSearch {
  id: string
  name: string
  description: string
  filters: SearchFilter[]
  created_at: string
  is_favorite: boolean
  usage_count: number
}

interface EnhancedSignalSearchProps {
  onSearch: (filters: SearchFilter[]) => void
  onClear: () => void
  signals: DemoSignal[]
  className?: string
}

export function EnhancedSignalSearch({ onSearch, onClear, signals, className }: EnhancedSignalSearchProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [filters, setFilters] = useState<SearchFilter[]>([])
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [quickSearch, setQuickSearch] = useState('')
  const [selectedSavedSearch, setSelectedSavedSearch] = useState<string>('')

  // Available filter fields with their configurations
  const filterFields = [
    {
      field: 'title',
      label: 'Title',
      icon: Hash,
      operators: ['contains', 'equals', 'starts_with', 'ends_with', 'not_contains']
    },
    {
      field: 'description',
      label: 'Description',
      icon: BookOpen,
      operators: ['contains', 'equals', 'not_contains']
    },
    {
      field: 'severity',
      label: 'Severity',
      icon: AlertTriangle,
      operators: ['equals', 'in', 'not_in'],
      predefinedValues: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
    },
    {
      field: 'status',
      label: 'Status',
      icon: CheckCircle,
      operators: ['equals', 'in', 'not_in'],
      predefinedValues: ['open', 'investigating', 'resolved', 'false-positive']
    },
    {
      field: 'service',
      label: 'Service',
      icon: Server,
      operators: ['equals', 'in', 'not_in', 'contains'],
      predefinedValues: ['auth-service', 'api-gateway', 'payment-service', 'user-service', 'data-service']
    },
    {
      field: 'timestamp',
      label: 'Detection Time',
      icon: Clock,
      operators: ['after', 'before', 'between', 'last_hours', 'last_days']
    },
    {
      field: 'source_ip',
      label: 'Source IP',
      icon: MapPin,
      operators: ['equals', 'in', 'subnet', 'not_equals']
    },
    {
      field: 'user_id',
      label: 'User ID',
      icon: User,
      operators: ['equals', 'in', 'contains', 'not_equals']
    },
    {
      field: 'rule_name',
      label: 'Rule Name',
      icon: Shield,
      operators: ['equals', 'contains', 'starts_with', 'not_contains']
    },
    {
      field: 'tags',
      label: 'Tags',
      icon: Tag,
      operators: ['has_tag', 'has_all_tags', 'has_any_tags', 'not_has_tag']
    },
    {
      field: 'priority_score',
      label: 'Priority Score',
      icon: Target,
      operators: ['greater_than', 'less_than', 'between', 'equals']
    },
    {
      field: 'confidence',
      label: 'Confidence',
      icon: Zap,
      operators: ['greater_than', 'less_than', 'between', 'equals']
    }
  ]

  // Mock saved searches
  const mockSavedSearches: SavedSearch[] = [
    {
      id: 'search-1',
      name: 'Critical Open Incidents',
      description: 'All critical severity signals that are still open',
      filters: [
        {
          id: 'f1',
          field: 'severity',
          operator: 'equals',
          value: 'CRITICAL',
          label: 'Severity equals CRITICAL'
        },
        {
          id: 'f2',
          field: 'status',
          operator: 'equals',
          value: 'open',
          label: 'Status equals open'
        }
      ],
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_favorite: true,
      usage_count: 45
    },
    {
      id: 'search-2',
      name: 'Auth Service Issues',
      description: 'All signals from authentication services in the last 24 hours',
      filters: [
        {
          id: 'f3',
          field: 'service',
          operator: 'in',
          value: ['auth-service', 'user-service'],
          label: 'Service in [auth-service, user-service]'
        },
        {
          id: 'f4',
          field: 'timestamp',
          operator: 'last_hours',
          value: '24',
          label: 'Last 24 hours'
        }
      ],
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      is_favorite: false,
      usage_count: 23
    },
    {
      id: 'search-3',
      name: 'High Priority Unresolved',
      description: 'High priority signals that need investigation',
      filters: [
        {
          id: 'f5',
          field: 'priority_score',
          operator: 'greater_than',
          value: '75',
          label: 'Priority Score > 75'
        },
        {
          id: 'f6',
          field: 'status',
          operator: 'in',
          value: ['open', 'investigating'],
          label: 'Status in [open, investigating]'
        }
      ],
      created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      is_favorite: true,
      usage_count: 67
    }
  ]

  useEffect(() => {
    setSavedSearches(mockSavedSearches)
  }, [])

  const addFilter = (field: string) => {
    const fieldConfig = filterFields.find(f => f.field === field)
    if (!fieldConfig) return

    const newFilter: SearchFilter = {
      id: `filter-${Date.now()}`,
      field,
      operator: fieldConfig.operators[0],
      value: fieldConfig.predefinedValues ? fieldConfig.predefinedValues[0] : '',
      label: `${fieldConfig.label} ${fieldConfig.operators[0]} ...`
    }

    setFilters([...filters, newFilter])
  }

  const updateFilter = (filterId: string, updates: Partial<SearchFilter>) => {
    setFilters(filters.map(filter =>
      filter.id === filterId
        ? { ...filter, ...updates }
        : filter
    ))
  }

  const removeFilter = (filterId: string) => {
    setFilters(filters.filter(f => f.id !== filterId))
  }

  const applyFilters = () => {
    onSearch(filters)
    setIsOpen(false)
  }

  const clearAllFilters = () => {
    setFilters([])
    setQuickSearch('')
    setSelectedSavedSearch('')
    onClear()
  }

  const loadSavedSearch = (searchId: string) => {
    const savedSearch = savedSearches.find(s => s.id === searchId)
    if (savedSearch) {
      setFilters(savedSearch.filters)
      setSelectedSavedSearch(searchId)
      onSearch(savedSearch.filters)
    }
  }

  const saveCurrentSearch = () => {
    if (filters.length === 0) return

    const name = prompt('Enter a name for this search:')
    if (!name) return

    const newSavedSearch: SavedSearch = {
      id: `search-${Date.now()}`,
      name,
      description: `Custom search with ${filters.length} filters`,
      filters: [...filters],
      created_at: new Date().toISOString(),
      is_favorite: false,
      usage_count: 0
    }

    setSavedSearches([...savedSearches, newSavedSearch])
    alert(`Search "${name}" saved successfully!`)
  }

  const getOperatorLabel = (operator: string) => {
    const labels: Record<string, string> = {
      contains: 'contains',
      equals: 'equals',
      not_equals: 'not equals',
      starts_with: 'starts with',
      ends_with: 'ends with',
      not_contains: 'does not contain',
      in: 'is in',
      not_in: 'is not in',
      greater_than: 'greater than',
      less_than: 'less than',
      between: 'between',
      after: 'after',
      before: 'before',
      last_hours: 'last N hours',
      last_days: 'last N days',
      subnet: 'in subnet',
      has_tag: 'has tag',
      has_all_tags: 'has all tags',
      has_any_tags: 'has any tags',
      not_has_tag: 'does not have tag'
    }
    return labels[operator] || operator
  }

  const formatFilterValue = (filter: SearchFilter) => {
    if (Array.isArray(filter.value)) {
      return filter.value.join(', ')
    }
    return filter.value.toString()
  }

  const performQuickSearch = () => {
    if (!quickSearch.trim()) {
      clearAllFilters()
      return
    }

    const quickFilters: SearchFilter[] = [
      {
        id: 'quick-title',
        field: 'title',
        operator: 'contains',
        value: quickSearch,
        label: `Title contains "${quickSearch}"`
      },
      {
        id: 'quick-description',
        field: 'description',
        operator: 'contains',
        value: quickSearch,
        label: `Description contains "${quickSearch}"`
      }
    ]

    setFilters(quickFilters)
    onSearch(quickFilters)
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Quick Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Quick search in title and description..."
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && performQuickSearch()}
            className="pl-10"
          />
        </div>
        <Button onClick={performQuickSearch} variant="outline">
          <Search className="w-4 h-4" />
        </Button>
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Advanced
              {filters.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {filters.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96 p-0" align="end">
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Advanced Search</h4>
                <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Saved Searches */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Saved Searches</Label>
                <Select value={selectedSavedSearch} onValueChange={loadSavedSearch}>
                  <SelectTrigger>
                    <SelectValue placeholder="Load a saved search..." />
                  </SelectTrigger>
                  <SelectContent>
                    {savedSearches.map(search => (
                      <SelectItem key={search.id} value={search.id}>
                        <div className="flex items-center gap-2">
                          {search.is_favorite && <Target className="w-3 h-3 text-yellow-500" />}
                          <span>{search.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {search.usage_count}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Add Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Add Filter</Label>
                <Command>
                  <CommandInput placeholder="Search filter fields..." />
                  <CommandList>
                    <CommandEmpty>No filter fields found.</CommandEmpty>
                    <CommandGroup>
                      {filterFields.map(field => {
                        const Icon = field.icon
                        return (
                          <CommandItem
                            key={field.field}
                            onSelect={() => addFilter(field.field)}
                          >
                            <Icon className="w-4 h-4 mr-2" />
                            {field.label}
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </div>

              {/* Active Filters */}
              {filters.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Active Filters ({filters.length})</Label>
                    <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                      Clear All
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {filters.map(filter => {
                      const fieldConfig = filterFields.find(f => f.field === filter.field)
                      const Icon = fieldConfig?.icon || Filter
                      return (
                        <div key={filter.id} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                          <Icon className="w-3 h-3" />
                          <div className="flex-1 text-xs">
                            <span className="font-medium">{fieldConfig?.label}</span>
                            <span className="text-gray-500 mx-1">{getOperatorLabel(filter.operator)}</span>
                            <span className="font-medium">{formatFilterValue(filter)}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFilter(filter.id)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t">
                <Button onClick={applyFilters} className="flex-1">
                  <Search className="w-4 h-4 mr-2" />
                  Apply Filters
                </Button>
                {filters.length > 0 && (
                  <Button variant="outline" onClick={saveCurrentSearch}>
                    <Save className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active Filters Display */}
      {filters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.map(filter => {
            const fieldConfig = filterFields.find(f => f.field === filter.field)
            const Icon = fieldConfig?.icon || Filter
            return (
              <Badge key={filter.id} variant="secondary" className="flex items-center gap-1">
                <Icon className="w-3 h-3" />
                <span className="text-xs">
                  {fieldConfig?.label} {getOperatorLabel(filter.operator)} {formatFilterValue(filter)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFilter(filter.id)}
                  className="h-auto p-0 ml-1"
                >
                  <X className="w-3 h-3" />
                </Button>
              </Badge>
            )
          })}
          <Button variant="ghost" size="sm" onClick={clearAllFilters}>
            <RefreshCw className="w-3 h-3 mr-1" />
            Clear All
          </Button>
        </div>
      )}
    </div>
  )
}