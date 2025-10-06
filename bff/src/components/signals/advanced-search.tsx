import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
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
  Calendar,
  Search,
  X,
  Filter,
  Plus,
  Minus,
  Clock,
  Shield,
  AlertCircle,
  Database
} from 'lucide-react'

interface SearchFilter {
  id: string
  field: string
  operator: string
  value: string
  label: string
}

interface AdvancedSearchProps {
  onSearch: (filters: SearchFilter[]) => void
  onClear: () => void
  className?: string
}

export function AdvancedSearch({ onSearch, onClear, className }: AdvancedSearchProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [filters, setFilters] = useState<SearchFilter[]>([])
  const [newFilter, setNewFilter] = useState({
    field: '',
    operator: '',
    value: ''
  })

  const searchFields = [
    { value: 'title', label: 'Title', icon: AlertCircle },
    { value: 'description', label: 'Description', icon: AlertCircle },
    { value: 'service', label: 'Service', icon: Database },
    { value: 'severity', label: 'Severity', icon: Shield },
    { value: 'status', label: 'Status', icon: Clock },
    { value: 'timestamp', label: 'Date/Time', icon: Calendar },
    { value: 'rule_name', label: 'Rule Name', icon: Shield },
    { value: 'user_id', label: 'User ID', icon: AlertCircle },
    { value: 'source_ip', label: 'Source IP', icon: Database },
  ]

  const operators = {
    text: [
      { value: 'contains', label: 'Contains' },
      { value: 'equals', label: 'Equals' },
      { value: 'starts_with', label: 'Starts with' },
      { value: 'ends_with', label: 'Ends with' },
    ],
    select: [
      { value: 'equals', label: 'Equals' },
      { value: 'not_equals', label: 'Not equals' },
    ],
    date: [
      { value: 'on', label: 'On' },
      { value: 'before', label: 'Before' },
      { value: 'after', label: 'After' },
      { value: 'between', label: 'Between' },
    ]
  }

  const getOperatorsForField = (field: string) => {
    if (field === 'timestamp') return operators.date
    if (field === 'severity' || field === 'status') return operators.select
    return operators.text
  }

  const getFieldValues = (field: string) => {
    switch (field) {
      case 'severity':
        return ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
      case 'status':
        return ['open', 'investigating', 'resolved', 'false-positive']
      case 'service':
        return ['auth-service', 'api-gateway', 'user-service', 'payment-service', 'notification-service']
      default:
        return []
    }
  }

  const addFilter = () => {
    if (!newFilter.field || !newFilter.operator || !newFilter.value) return

    const field = searchFields.find(f => f.value === newFilter.field)
    const operator = getOperatorsForField(newFilter.field).find(op => op.value === newFilter.operator)

    if (!field || !operator) return

    const filter: SearchFilter = {
      id: Date.now().toString(),
      field: newFilter.field,
      operator: newFilter.operator,
      value: newFilter.value,
      label: `${field.label} ${operator.label.toLowerCase()} "${newFilter.value}"`
    }

    setFilters([...filters, filter])
    setNewFilter({ field: '', operator: '', value: '' })
  }

  const removeFilter = (id: string) => {
    setFilters(filters.filter(f => f.id !== id))
  }

  const clearAllFilters = () => {
    setFilters([])
    setNewFilter({ field: '', operator: '', value: '' })
    onClear()
  }

  const applyFilters = () => {
    onSearch(filters)
    setIsOpen(false)
  }

  const renderValueInput = () => {
    const fieldValues = getFieldValues(newFilter.field)

    if (fieldValues.length > 0) {
      return (
        <Select value={newFilter.value} onValueChange={(value) => setNewFilter({...newFilter, value})}>
          <SelectTrigger>
            <SelectValue placeholder="Select value" />
          </SelectTrigger>
          <SelectContent>
            {fieldValues.map(value => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }

    if (newFilter.field === 'timestamp') {
      return (
        <Input
          type="date"
          value={newFilter.value}
          onChange={(e) => setNewFilter({...newFilter, value: e.target.value})}
          placeholder="Select date"
        />
      )
    }

    return (
      <Input
        value={newFilter.value}
        onChange={(e) => setNewFilter({...newFilter, value: e.target.value})}
        placeholder="Enter value"
      />
    )
  }

  return (
    <div className={className}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="relative">
            <Search className="w-4 h-4 mr-2" />
            Advanced Search
            {filters.length > 0 && (
              <Badge variant="secondary" className="ml-2 px-1.5 py-0.5 text-xs">
                {filters.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-4" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Advanced Search</h4>
              {filters.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                  Clear all
                </Button>
              )}
            </div>

            {/* Active Filters */}
            {filters.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">Active Filters</Label>
                <div className="space-y-1">
                  {filters.map(filter => (
                    <div key={filter.id} className="flex items-center gap-2">
                      <Badge variant="secondary" className="flex-1 justify-start">
                        <Filter className="w-3 h-3 mr-1" />
                        {filter.label}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFilter(filter.id)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add New Filter */}
            <div className="space-y-3 pt-3 border-t">
              <Label className="text-xs text-gray-500">Add Filter</Label>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Field</Label>
                  <Select value={newFilter.field} onValueChange={(value) => setNewFilter({...newFilter, field: value, operator: '', value: ''})}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      {searchFields.map(field => {
                        const Icon = field.icon
                        return (
                          <SelectItem key={field.value} value={field.value}>
                            <div className="flex items-center gap-2">
                              <Icon className="w-3 h-3" />
                              {field.label}
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Operator</Label>
                  <Select
                    value={newFilter.operator}
                    onValueChange={(value) => setNewFilter({...newFilter, operator: value})}
                    disabled={!newFilter.field}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Select operator" />
                    </SelectTrigger>
                    <SelectContent>
                      {newFilter.field && getOperatorsForField(newFilter.field).map(op => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs">Value</Label>
                {renderValueInput()}
              </div>

              <Button
                onClick={addFilter}
                disabled={!newFilter.field || !newFilter.operator || !newFilter.value}
                className="w-full h-8"
                size="sm"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Filter
              </Button>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-3 border-t">
              <Button onClick={applyFilters} className="flex-1" size="sm">
                Apply Filters
              </Button>
              <Button variant="outline" onClick={() => setIsOpen(false)} size="sm">
                Cancel
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Quick Filters Display */}
      {filters.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {filters.map(filter => (
            <Badge key={filter.id} variant="outline" className="text-xs">
              {filter.label}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFilter(filter.id)}
                className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
              >
                <X className="w-2 h-2" />
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}