import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MonacoRuleEditor } from './monaco-rule-editor'
import { ValidationFeedback } from './validation-feedback'
import { Badge } from '@/components/ui/badge'
import type { ParseResult } from '@/lib/validation/dsl-parser'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import {
  Code,
  Play,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  FileCode,
  TestTube,
  Zap,
  History,
  Copy,
  Download,
  Upload,
  HelpCircle,
  AlertTriangle,
  Info,
  BookOpen
} from 'lucide-react'

interface RuleEditorProps {
  rule?: any
  onSave: (ruleData: any) => void
  onCancel: () => void
  isLoading?: boolean
  mode?: 'create' | 'edit'
}

interface TestResult {
  passed: boolean
  output?: any
  error?: string
  executionTime?: number
  matchedConditions?: string[]
}

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  suggestions: string[]
}

const OGNL_TEMPLATES = {
  'user-behavior': {
    name: 'User Behavior Pattern',
    expression: 'user.failedLogins > 5 && user.lastLogin < #now - 3600000',
    description: 'Detect suspicious user behavior patterns'
  },
  'resource-access': {
    name: 'Resource Access Control',
    expression: 'resource.type == "sensitive" && !user.permissions.contains("admin")',
    description: 'Monitor unauthorized access to sensitive resources'
  },
  'performance': {
    name: 'Performance Threshold',
    expression: 'span.duration > 5000 && span.service == "api-gateway"',
    description: 'Alert on slow API responses'
  },
  'error-rate': {
    name: 'Error Rate Monitor',
    expression: 'metrics.errorRate > 0.05 && metrics.requestCount > 100',
    description: 'Detect high error rates in production'
  },
  'business-logic': {
    name: 'Business Rule Violation',
    expression: 'order.amount > customer.creditLimit && order.status == "pending"',
    description: 'Identify business rule violations'
  }
}

const SEVERITY_LEVELS = [
  { value: 'CRITICAL', label: 'Critical', color: 'bg-red-500' },
  { value: 'HIGH', label: 'High', color: 'bg-orange-500' },
  { value: 'MEDIUM', label: 'Medium', color: 'bg-yellow-500' },
  { value: 'LOW', label: 'Low', color: 'bg-blue-500' },
  { value: 'INFO', label: 'Info', color: 'bg-gray-500' }
]

export function RuleEditor({ rule, onSave, onCancel, isLoading, mode = 'create' }: RuleEditorProps) {
  const [formData, setFormData] = useState({
    name: rule?.name || '',
    description: rule?.description || '',
    expression: rule?.expression || '',
    severity: rule?.severity || 'MEDIUM',
    tags: rule?.tags || [],
    enabled: rule?.enabled ?? true,
    metadata: rule?.metadata || {}
  })

  const [testData, setTestData] = useState('{\n  "user": {\n    "id": "123",\n    "role": "viewer"\n  },\n  "span": {\n    "duration": 1000,\n    "service": "api"\n  }\n}')
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [dslValidation, setDslValidation] = useState<ParseResult | null>(null)
  const [activeTab, setActiveTab] = useState('editor')
  const [tagInput, setTagInput] = useState('')
  const [expressionHistory, setExpressionHistory] = useState<string[]>([])
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    if (formData.expression) {
      validateExpression(formData.expression)
    }
  }, [formData.expression])

  const validateExpression = (expression: string) => {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: []
    }

    // Basic OGNL validation
    if (!expression.trim()) {
      result.valid = false
      result.errors.push('Expression cannot be empty')
    }

    // Check for common OGNL syntax issues
    const openParens = (expression.match(/\(/g) || []).length
    const closeParens = (expression.match(/\)/g) || []).length
    if (openParens !== closeParens) {
      result.valid = false
      result.errors.push('Unbalanced parentheses')
    }

    const openBrackets = (expression.match(/\[/g) || []).length
    const closeBrackets = (expression.match(/\]/g) || []).length
    if (openBrackets !== closeBrackets) {
      result.valid = false
      result.errors.push('Unbalanced brackets')
    }

    // Check for common mistakes
    if (expression.includes('=') && !expression.includes('==')) {
      result.warnings.push('Did you mean to use "==" for comparison instead of "="?')
    }

    if (expression.includes('&&') && expression.includes('||')) {
      result.suggestions.push('Consider using parentheses to clarify operator precedence')
    }

    if (expression.length > 500) {
      result.warnings.push('Complex expressions may impact performance')
    }

    // Check for security issues
    if (expression.includes('@') || expression.includes('#')) {
      result.warnings.push('Be careful with OGNL static method calls and variables')
    }

    setValidation(result)
  }

  const handleTest = () => {
    try {
      const data = JSON.parse(testData)

      // Simulate OGNL evaluation (in production, this would call the backend)
      const mockEvaluate = (expr: string, context: any): boolean => {
        // This is a simplified mock - real OGNL evaluation would happen server-side
        try {
          // Simple mock evaluation for demo
          if (expr.includes('user.role == "viewer"')) {
            return context.user?.role === 'viewer'
          }
          if (expr.includes('span.duration > 5000')) {
            return context.span?.duration > 5000
          }
          // Default to random for demo
          return Math.random() > 0.5
        } catch {
          return false
        }
      }

      const startTime = performance.now()
      const result = mockEvaluate(formData.expression, data)
      const endTime = performance.now()

      setTestResult({
        passed: result,
        output: result ? 'Rule matched' : 'Rule did not match',
        executionTime: endTime - startTime,
        matchedConditions: result ? [formData.expression] : []
      })
    } catch (error: any) {
      setTestResult({
        passed: false,
        error: error.message || 'Failed to parse test data'
      })
    }
  }

  const handleTemplateSelect = (templateKey: string) => {
    const template = OGNL_TEMPLATES[templateKey as keyof typeof OGNL_TEMPLATES]
    if (template) {
      setFormData({
        ...formData,
        name: template.name,
        description: template.description,
        expression: template.expression
      })
    }
  }

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()]
      })
      setTagInput('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((t: string) => t !== tag)
    })
  }

  const handleSave = () => {
    if (validation?.valid && formData.name && formData.expression) {
      // Save to history
      if (!expressionHistory.includes(formData.expression)) {
        setExpressionHistory([formData.expression, ...expressionHistory.slice(0, 4)])
      }
      onSave(formData)
    }
  }

  const exportRule = () => {
    const dataStr = JSON.stringify(formData, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)

    const exportFileDefaultName = `rule-${formData.name.toLowerCase().replace(/\s+/g, '-')}.json`

    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="editor" className="flex items-center gap-2">
            <FileCode className="w-4 h-4" />
            Editor
          </TabsTrigger>
          <TabsTrigger value="test" className="flex items-center gap-2">
            <TestTube className="w-4 h-4" />
            Test
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="space-y-4">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Rule Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Rule Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Suspicious Login Activity"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="severity">Severity</Label>
                  <Select
                    value={formData.severity}
                    onValueChange={(value) => setFormData({ ...formData, severity: value })}
                  >
                    <SelectTrigger id="severity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEVERITY_LEVELS.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${level.color}`} />
                            {level.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what this rule detects..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    placeholder="Add a tag..."
                  />
                  <Button onClick={handleAddTag} size="sm">Add</Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.tags.map((tag: string) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                      <X
                        className="ml-1 h-3 w-3 cursor-pointer"
                        onClick={() => handleRemoveTag(tag)}
                      />
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* OGNL Expression Editor */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>OGNL Expression *</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowHelp(!showHelp)}
                >
                  <HelpCircle className="w-4 h-4 mr-2" />
                  Help
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {showHelp && (
                <Alert>
                  <BookOpen className="h-4 w-4" />
                  <AlertTitle>OGNL Expression Help</AlertTitle>
                  <AlertDescription className="mt-2 space-y-2">
                    <p>OGNL (Object-Graph Navigation Language) allows you to create powerful rules:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li>Access properties: <code>user.name</code></li>
                      <li>Compare values: <code>span.duration &gt; 1000</code></li>
                      <li>Logical operators: <code>&amp;&amp;</code> (AND), <code>||</code> (OR), <code>!</code> (NOT)</li>
                      <li>String operations: <code>message.contains("error")</code></li>
                      <li>Collections: <code>tags.contains("production")</code></li>
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <MonacoRuleEditor
                  value={formData.expression}
                  onChange={(value) => setFormData({ ...formData, expression: value })}
                  onValidationChange={setDslValidation}
                  height="300px"
                  className="font-mono text-sm"
                />

                <ValidationFeedback
                  validation={dslValidation}
                  isValidating={false}
                />

                {validation && (
                  <div className="space-y-2">
                    {validation.errors.length > 0 && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Validation Errors</AlertTitle>
                        <AlertDescription>
                          <ul className="list-disc list-inside">
                            {validation.errors.map((error, i) => (
                              <li key={i}>{error}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}

                    {validation.warnings.length > 0 && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Warnings</AlertTitle>
                        <AlertDescription>
                          <ul className="list-disc list-inside">
                            {validation.warnings.map((warning, i) => (
                              <li key={i}>{warning}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}

                    {validation.valid && validation.errors.length === 0 && (
                      <Alert className="border-green-200 bg-green-50">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertTitle className="text-green-800">Valid Expression</AlertTitle>
                        <AlertDescription className="text-green-700">
                          Your OGNL expression syntax is valid.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Your Rule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Test Data (JSON)</Label>
                  <Textarea
                    value={testData}
                    onChange={(e) => setTestData(e.target.value)}
                    className="font-mono text-sm"
                    rows={12}
                    placeholder="Enter test data as JSON..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Test Result</Label>
                  <div className="border rounded-lg p-4 min-h-[288px] bg-gray-50 dark:bg-gray-900">
                    {testResult ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {testResult.passed ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <X className="w-5 h-5 text-red-600" />
                          )}
                          <span className={`font-semibold ${testResult.passed ? 'text-green-600' : 'text-red-600'}`}>
                            {testResult.passed ? 'Rule Matched' : 'Rule Did Not Match'}
                          </span>
                        </div>
                        {testResult.executionTime !== undefined && (
                          <p className="text-sm text-gray-600">
                            Execution time: {testResult.executionTime.toFixed(2)}ms
                          </p>
                        )}
                        {testResult.error && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{testResult.error}</AlertDescription>
                          </Alert>
                        )}
                        {testResult.matchedConditions && testResult.matchedConditions.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-1">Matched Conditions:</p>
                            <ul className="list-disc list-inside text-sm text-gray-600">
                              {testResult.matchedConditions.map((condition, i) => (
                                <li key={i} className="font-mono">{condition}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        <div className="text-center">
                          <TestTube className="w-8 h-8 mx-auto mb-2" />
                          <p>Click "Run Test" to test your rule</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleTest} disabled={!formData.expression || !validation?.valid}>
                  <Play className="w-4 h-4 mr-2" />
                  Run Test
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rule Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {Object.entries(OGNL_TEMPLATES).map(([key, template]) => (
                  <div
                    key={key}
                    className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                    onClick={() => handleTemplateSelect(key)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h4 className="font-semibold">{template.name}</h4>
                        <p className="text-sm text-gray-600">{template.description}</p>
                        <code className="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">
                          {template.expression}
                        </code>
                      </div>
                      <Button size="sm" variant="ghost">
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Expression History</CardTitle>
            </CardHeader>
            <CardContent>
              {expressionHistory.length > 0 ? (
                <div className="space-y-2">
                  {expressionHistory.map((expr, i) => (
                    <div
                      key={i}
                      className="border rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                      onClick={() => setFormData({ ...formData, expression: expr })}
                    >
                      <code className="text-sm">{expr}</code>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No expression history yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportRule}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!validation?.valid || !formData.name || !formData.expression || isLoading}
          >
            {isLoading ? (
              <>Loading...</>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {mode === 'create' ? 'Create Rule' : 'Update Rule'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}