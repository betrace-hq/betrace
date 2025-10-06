import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Shield,
  Clock,
  Target,
  Zap,
  Brain,
  Activity,
  Users,
  Server,
  Eye,
  Settings,
  Info
} from 'lucide-react'
import { DemoSignal } from '@/lib/api/demo-api'

interface PriorityScore {
  total: number
  breakdown: {
    severity: number
    impact: number
    confidence: number
    velocity: number
    context: number
  }
  factors: string[]
  recommendation: string
  urgency: 'critical' | 'high' | 'medium' | 'low'
}

interface PriorityWeight {
  severity: number
  impact: number
  confidence: number
  velocity: number
  context: number
}

interface PriorityScoringProps {
  signal: DemoSignal
  className?: string
  compact?: boolean
}

export function PriorityScoring({ signal, className, compact = false }: PriorityScoringProps) {
  const [priorityScore, setPriorityScore] = useState<PriorityScore | null>(null)
  const [weights, setWeights] = useState<PriorityWeight>({
    severity: 0.3,
    impact: 0.25,
    confidence: 0.2,
    velocity: 0.15,
    context: 0.1
  })
  const [isCalculating, setIsCalculating] = useState(false)

  const calculatePriorityScore = async (customWeights?: PriorityWeight) => {
    setIsCalculating(true)

    // Simulate ML-based scoring calculation
    await new Promise(resolve => setTimeout(resolve, 800))

    const currentWeights = customWeights || weights

    // Base scores (0-100)
    const severityScore = getSeverityScore(signal.severity)
    const impactScore = getImpactScore(signal)
    const confidenceScore = getConfidenceScore(signal)
    const velocityScore = getVelocityScore(signal)
    const contextScore = getContextScore(signal)

    // Weighted total
    const total = Math.round(
      severityScore * currentWeights.severity +
      impactScore * currentWeights.impact +
      confidenceScore * currentWeights.confidence +
      velocityScore * currentWeights.velocity +
      contextScore * currentWeights.context
    )

    const factors = []
    if (severityScore >= 80) factors.push('High severity rating')
    if (impactScore >= 70) factors.push('Significant business impact')
    if (confidenceScore >= 85) factors.push('High confidence detection')
    if (velocityScore >= 75) factors.push('Rapid progression detected')
    if (contextScore >= 60) factors.push('Historical patterns identified')

    const urgency = total >= 80 ? 'critical' :
                   total >= 60 ? 'high' :
                   total >= 40 ? 'medium' : 'low'

    const recommendations = {
      critical: 'Immediate investigation required. Escalate to senior analyst.',
      high: 'Priority investigation. Assign experienced analyst within 30 minutes.',
      medium: 'Standard investigation timeline. Assign within 2 hours.',
      low: 'Low priority. Can be investigated during normal business hours.'
    }

    const score: PriorityScore = {
      total,
      breakdown: {
        severity: Math.round(severityScore * currentWeights.severity),
        impact: Math.round(impactScore * currentWeights.impact),
        confidence: Math.round(confidenceScore * currentWeights.confidence),
        velocity: Math.round(velocityScore * currentWeights.velocity),
        context: Math.round(contextScore * currentWeights.context)
      },
      factors,
      recommendation: recommendations[urgency],
      urgency
    }

    setPriorityScore(score)
    setIsCalculating(false)
  }

  useEffect(() => {
    calculatePriorityScore()
  }, [signal])

  const getSeverityScore = (severity: string): number => {
    switch (severity.toUpperCase()) {
      case 'CRITICAL': return 95
      case 'HIGH': return 75
      case 'MEDIUM': return 50
      case 'LOW': return 25
      default: return 0
    }
  }

  const getImpactScore = (signal: DemoSignal): number => {
    // Simulated impact scoring based on service criticality
    const criticalServices = ['auth-service', 'payment-service']
    const highImpactServices = ['api-gateway', 'user-service']

    if (criticalServices.includes(signal.service)) return 90
    if (highImpactServices.includes(signal.service)) return 70
    return 40
  }

  const getConfidenceScore = (signal: DemoSignal): number => {
    // Simulated confidence based on detection method
    return Math.floor(Math.random() * 20) + 75 // 75-95
  }

  const getVelocityScore = (signal: DemoSignal): number => {
    // Simulated velocity based on time since detection
    const hoursOld = (Date.now() - new Date(signal.timestamp).getTime()) / (1000 * 60 * 60)
    if (hoursOld < 1) return 85
    if (hoursOld < 6) return 60
    if (hoursOld < 24) return 40
    return 20
  }

  const getContextScore = (signal: DemoSignal): number => {
    // Simulated context scoring
    return Math.floor(Math.random() * 30) + 40 // 40-70
  }

  const getPriorityColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'text-red-600 dark:text-red-400'
      case 'high': return 'text-orange-600 dark:text-orange-400'
      case 'medium': return 'text-yellow-600 dark:text-yellow-400'
      case 'low': return 'text-green-600 dark:text-green-400'
      default: return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getPriorityBadgeVariant = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'destructive'
      case 'high': return 'default'
      case 'medium': return 'secondary'
      case 'low': return 'outline'
      default: return 'outline'
    }
  }

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-2 ${className}`}>
              {isCalculating ? (
                <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
              ) : priorityScore ? (
                <>
                  <Target className={`w-4 h-4 ${getPriorityColor(priorityScore.urgency)}`} />
                  <span className={`text-sm font-semibold ${getPriorityColor(priorityScore.urgency)}`}>
                    {priorityScore.total}
                  </span>
                  <Badge variant={getPriorityBadgeVariant(priorityScore.urgency)}>
                    {priorityScore.urgency.toUpperCase()}
                  </Badge>
                </>
              ) : (
                <span className="text-sm text-gray-500">No score</span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm">
            <div className="space-y-2">
              <p className="font-medium">Priority Score Breakdown</p>
              {priorityScore && (
                <>
                  <div className="space-y-1 text-sm">
                    <div>Severity: {priorityScore.breakdown.severity}pts</div>
                    <div>Impact: {priorityScore.breakdown.impact}pts</div>
                    <div>Confidence: {priorityScore.breakdown.confidence}pts</div>
                  </div>
                  <p className="text-xs text-gray-600">{priorityScore.recommendation}</p>
                </>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5" />
          Priority Score
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>AI-powered priority scoring based on multiple factors</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isCalculating ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-500">Calculating priority score...</p>
            </div>
          </div>
        ) : priorityScore ? (
          <>
            {/* Overall Score */}
            <div className="text-center">
              <div className={`text-4xl font-bold mb-2 ${getPriorityColor(priorityScore.urgency)}`}>
                {priorityScore.total}
              </div>
              <Badge variant={getPriorityBadgeVariant(priorityScore.urgency)} className="mb-2">
                {priorityScore.urgency.toUpperCase()} PRIORITY
              </Badge>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {priorityScore.recommendation}
              </p>
            </div>

            {/* Score Breakdown */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Score Breakdown</h4>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Severity
                  </span>
                  <div className="flex items-center gap-2">
                    <Progress value={priorityScore.breakdown.severity} className="w-16 h-2" />
                    <span className="text-sm font-medium w-8">{priorityScore.breakdown.severity}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    <Server className="w-4 h-4" />
                    Impact
                  </span>
                  <div className="flex items-center gap-2">
                    <Progress value={priorityScore.breakdown.impact} className="w-16 h-2" />
                    <span className="text-sm font-medium w-8">{priorityScore.breakdown.impact}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Confidence
                  </span>
                  <div className="flex items-center gap-2">
                    <Progress value={priorityScore.breakdown.confidence} className="w-16 h-2" />
                    <span className="text-sm font-medium w-8">{priorityScore.breakdown.confidence}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Velocity
                  </span>
                  <div className="flex items-center gap-2">
                    <Progress value={priorityScore.breakdown.velocity} className="w-16 h-2" />
                    <span className="text-sm font-medium w-8">{priorityScore.breakdown.velocity}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Context
                  </span>
                  <div className="flex items-center gap-2">
                    <Progress value={priorityScore.breakdown.context} className="w-16 h-2" />
                    <span className="text-sm font-medium w-8">{priorityScore.breakdown.context}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Contributing Factors */}
            {priorityScore.factors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Key Factors</h4>
                <div className="space-y-1">
                  {priorityScore.factors.map((factor, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                      {factor}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => calculatePriorityScore()}
                className="flex-1"
              >
                <Brain className="w-4 h-4 mr-2" />
                Recalculate
              </Button>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-500">Unable to calculate priority score</p>
            <Button variant="outline" size="sm" onClick={() => calculatePriorityScore()} className="mt-2">
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}