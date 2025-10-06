import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  Brain,
  TrendingUp,
  Target,
  AlertTriangle,
  Eye,
  Zap,
  Network,
  Clock,
  BarChart3,
  PieChart,
  Activity,
  Shield,
  Search,
  Filter,
  RefreshCw,
  Lightbulb,
  GitBranch,
  Layers,
  Hash,
  ArrowRight,
  CheckCircle,
  XCircle,
  Info,
  ExternalLink,
  Database,
  Cpu,
  Bot,
  Sparkles,
  Radar,
  Binary,
  LineChart,
  Gauge,
  Plus
} from 'lucide-react'
import { DemoSignal } from '@/lib/api/demo-api'

interface SignalMLInsightsProps {
  signal?: DemoSignal
  signals?: DemoSignal[]
  className?: string
}

interface MLCorrelation {
  id: string
  related_signal_id: string
  correlation_type: 'temporal' | 'behavioral' | 'network' | 'user' | 'asset'
  confidence_score: number
  similarity_score: number
  description: string
  evidence: string[]
  created_at: string
}

interface MLPrediction {
  id: string
  prediction_type: 'escalation' | 'false_positive' | 'attack_progression' | 'impact_assessment'
  confidence: number
  prediction: string
  reasoning: string[]
  recommended_actions: string[]
  model_version: string
  created_at: string
}

interface AnomalyDetection {
  id: string
  anomaly_type: 'frequency' | 'pattern' | 'volume' | 'timing' | 'user_behavior'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  baseline_value: number
  observed_value: number
  deviation_percentage: number
  affected_entities: string[]
  detection_time: string
}

interface ThreatHunting {
  id: string
  hypothesis: string
  status: 'investigating' | 'confirmed' | 'dismissed' | 'escalated'
  confidence: number
  iocs: string[]
  ttps: string[]
  evidence_count: number
  created_at: string
  updated_at: string
}

interface MLModel {
  id: string
  name: string
  type: 'classification' | 'regression' | 'clustering' | 'anomaly_detection'
  accuracy: number
  last_trained: string
  training_data_size: number
  status: 'active' | 'training' | 'deprecated'
  description: string
}

export function SignalMLInsights({ signal, signals = [], className }: SignalMLInsightsProps) {
  const [activeTab, setActiveTab] = useState('correlations')
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Mock ML correlations
  const [correlations, setCorrelations] = useState<MLCorrelation[]>([
    {
      id: 'corr-1',
      related_signal_id: 'signal-456',
      correlation_type: 'temporal',
      confidence_score: 0.89,
      similarity_score: 0.76,
      description: 'Similar attack pattern detected 2 hours before this signal',
      evidence: [
        'Same source IP range (192.168.1.x)',
        'Identical user-agent string',
        'Similar request patterns'
      ],
      created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString()
    },
    {
      id: 'corr-2',
      related_signal_id: 'signal-789',
      correlation_type: 'behavioral',
      confidence_score: 0.73,
      similarity_score: 0.82,
      description: 'Behavioral pattern matches previous privilege escalation attempt',
      evidence: [
        'API endpoint targeting sequence',
        'Error response patterns',
        'Request timing distribution'
      ],
      created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString()
    },
    {
      id: 'corr-3',
      related_signal_id: 'signal-321',
      correlation_type: 'network',
      confidence_score: 0.95,
      similarity_score: 0.91,
      description: 'Network traffic anomaly from same subnet detected',
      evidence: [
        'Unusual outbound connections',
        'Data transfer volume spike',
        'DNS query patterns'
      ],
      created_at: new Date(Date.now() - 90 * 60 * 1000).toISOString()
    }
  ])

  // Mock ML predictions
  const [predictions, setPredictions] = useState<MLPrediction[]>([
    {
      id: 'pred-1',
      prediction_type: 'escalation',
      confidence: 0.84,
      prediction: 'High likelihood of escalation to critical severity within 2 hours',
      reasoning: [
        'Pattern matches 87% of historical escalations',
        'Attacker showing persistence behaviors',
        'Multiple attack vectors being explored'
      ],
      recommended_actions: [
        'Increase monitoring on affected systems',
        'Prepare incident response team',
        'Review containment options'
      ],
      model_version: 'escalation-predictor-v2.1',
      created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString()
    },
    {
      id: 'pred-2',
      prediction_type: 'attack_progression',
      confidence: 0.77,
      prediction: 'Likely progression to lateral movement phase',
      reasoning: [
        'Current phase matches reconnaissance patterns',
        'Network scanning behavior detected',
        'Credential harvesting attempts identified'
      ],
      recommended_actions: [
        'Monitor east-west network traffic',
        'Review privileged account activity',
        'Deploy additional network sensors'
      ],
      model_version: 'attack-progression-v1.8',
      created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString()
    }
  ])

  // Mock anomaly detections
  const [anomalies, setAnomalies] = useState<AnomalyDetection[]>([
    {
      id: 'anom-1',
      anomaly_type: 'frequency',
      severity: 'high',
      description: 'Unusual spike in API requests from this source',
      baseline_value: 45,
      observed_value: 234,
      deviation_percentage: 420,
      affected_entities: ['api-gateway', 'user-service'],
      detection_time: new Date(Date.now() - 20 * 60 * 1000).toISOString()
    },
    {
      id: 'anom-2',
      anomaly_type: 'timing',
      severity: 'medium',
      description: 'Access attempts during unusual hours for this user',
      baseline_value: 0,
      observed_value: 12,
      deviation_percentage: 1200,
      affected_entities: ['admin-portal'],
      detection_time: new Date(Date.now() - 35 * 60 * 1000).toISOString()
    },
    {
      id: 'anom-3',
      anomaly_type: 'pattern',
      severity: 'critical',
      description: 'Never-before-seen attack signature detected',
      baseline_value: 0,
      observed_value: 1,
      deviation_percentage: 100,
      affected_entities: ['web-application', 'database'],
      detection_time: new Date(Date.now() - 60 * 60 * 1000).toISOString()
    }
  ])

  // Mock threat hunting hypotheses
  const [threatHunting, setThreatHunting] = useState<ThreatHunting[]>([
    {
      id: 'hunt-1',
      hypothesis: 'APT group using living-off-the-land techniques for persistence',
      status: 'investigating',
      confidence: 0.72,
      iocs: ['powershell.exe', 'schtasks.exe', 'reg.exe'],
      ttps: ['T1053.005', 'T1112', 'T1055'],
      evidence_count: 8,
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString()
    },
    {
      id: 'hunt-2',
      hypothesis: 'Insider threat using legitimate tools for data exfiltration',
      status: 'confirmed',
      confidence: 0.91,
      iocs: ['unusual_file_access.log', 'large_email_attachments'],
      ttps: ['T1041', 'T1567'],
      evidence_count: 15,
      created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString()
    }
  ])

  // Mock ML models
  const [mlModels, setMlModels] = useState<MLModel[]>([
    {
      id: 'model-1',
      name: 'Threat Classification Engine',
      type: 'classification',
      accuracy: 0.943,
      last_trained: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      training_data_size: 2547893,
      status: 'active',
      description: 'Classifies security signals into threat categories with high accuracy'
    },
    {
      id: 'model-2',
      name: 'Anomaly Detection System',
      type: 'anomaly_detection',
      accuracy: 0.887,
      last_trained: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      training_data_size: 1872456,
      status: 'active',
      description: 'Detects unusual patterns in network traffic and user behavior'
    },
    {
      id: 'model-3',
      name: 'Attack Progression Predictor',
      type: 'regression',
      accuracy: 0.821,
      last_trained: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      training_data_size: 945672,
      status: 'training',
      description: 'Predicts likelihood and timeline of attack escalation'
    }
  ])

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true)

    // Simulate ML analysis
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Add new correlation
    const newCorrelation: MLCorrelation = {
      id: `corr-${Date.now()}`,
      related_signal_id: `signal-${Math.floor(Math.random() * 1000)}`,
      correlation_type: 'user',
      confidence_score: 0.67 + Math.random() * 0.3,
      similarity_score: 0.6 + Math.random() * 0.35,
      description: 'User behavior anomaly detected in related timeline',
      evidence: [
        'Unusual login patterns',
        'Access to restricted resources',
        'Multiple failed authentication attempts'
      ],
      created_at: new Date().toISOString()
    }

    setCorrelations(prev => [newCorrelation, ...prev])
    setIsAnalyzing(false)
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 dark:text-green-400'
    if (confidence >= 0.6) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getConfidenceBadge = (confidence: number) => {
    const percentage = Math.round(confidence * 100)
    if (confidence >= 0.8) {
      return <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400">{percentage}%</Badge>
    }
    if (confidence >= 0.6) {
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400">{percentage}%</Badge>
    }
    return <Badge className="bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400">{percentage}%</Badge>
  }

  const getSeverityBadge = (severity: string) => {
    const severityConfig = {
      critical: { className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400', label: 'Critical' },
      high: { className: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400', label: 'High' },
      medium: { className: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400', label: 'Medium' },
      low: { className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400', label: 'Low' }
    } as const

    const config = severityConfig[severity as keyof typeof severityConfig] || severityConfig.low

    return (
      <Badge variant="outline" className={`${config.className} text-xs px-2 py-0.5`}>
        {config.label}
      </Badge>
    )
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      investigating: { className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400', label: 'Investigating' },
      confirmed: { className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400', label: 'Confirmed' },
      dismissed: { className: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400', label: 'Dismissed' },
      escalated: { className: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400', label: 'Escalated' }
    } as const

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.investigating

    return (
      <Badge variant="outline" className={`${config.className} text-xs px-2 py-0.5`}>
        {config.label}
      </Badge>
    )
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

  return (
    <Card className={`border-gray-200 dark:border-gray-700 ${className}`}>
      <CardHeader className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <Brain className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            ML-Powered Intelligence
            <Badge variant="outline" className="ml-2">
              AI Insights
            </Badge>
          </CardTitle>
          <Button
            onClick={handleRunAnalysis}
            disabled={isAnalyzing}
            size="sm"
            variant="outline"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-1" />
                Run Analysis
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="correlations">
              <Network className="w-4 h-4 mr-2" />
              Correlations ({correlations.length})
            </TabsTrigger>
            <TabsTrigger value="predictions">
              <TrendingUp className="w-4 h-4 mr-2" />
              Predictions ({predictions.length})
            </TabsTrigger>
            <TabsTrigger value="anomalies">
              <Radar className="w-4 h-4 mr-2" />
              Anomalies ({anomalies.length})
            </TabsTrigger>
            <TabsTrigger value="hunting">
              <Target className="w-4 h-4 mr-2" />
              Threat Hunting ({threatHunting.length})
            </TabsTrigger>
            <TabsTrigger value="models">
              <Cpu className="w-4 h-4 mr-2" />
              Models ({mlModels.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="correlations" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Signal Correlations</h3>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Info className="w-4 h-4" />
                ML-detected relationships
              </div>
            </div>

            <div className="space-y-3">
              {correlations.map(correlation => (
                <div key={correlation.id} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          Related Signal: {correlation.related_signal_id}
                        </h4>
                        <Badge variant="outline" className="text-xs capitalize">
                          {correlation.correlation_type.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {correlation.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getConfidenceBadge(correlation.confidence_score)}
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Evidence:</h5>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      {correlation.evidence.map((evidence, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                          {evidence}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Similarity: {Math.round(correlation.similarity_score * 100)}%</span>
                    <span>Detected: {formatTimeAgo(correlation.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="predictions" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI Predictions</h3>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Lightbulb className="w-4 h-4" />
                Predictive insights
              </div>
            </div>

            <div className="space-y-4">
              {predictions.map(prediction => (
                <div key={prediction.id} className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {prediction.prediction}
                        </h4>
                        <Badge variant="outline" className="text-xs capitalize">
                          {prediction.prediction_type.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                    {getConfidenceBadge(prediction.confidence)}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Reasoning:</h5>
                      <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        {prediction.reasoning.map((reason, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <ArrowRight className="w-3 h-3 text-blue-500 flex-shrink-0 mt-0.5" />
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Recommended Actions:</h5>
                      <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        {prediction.recommended_actions.map((action, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <Target className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                    <span>Model: {prediction.model_version}</span>
                    <span>Generated: {formatTimeAgo(prediction.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="anomalies" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Anomaly Detection</h3>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <AlertTriangle className="w-4 h-4" />
                Statistical outliers
              </div>
            </div>

            <div className="space-y-3">
              {anomalies.map(anomaly => (
                <div key={anomaly.id} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {anomaly.description}
                        </h4>
                        <Badge variant="outline" className="text-xs capitalize">
                          {anomaly.anomaly_type.replace('_', ' ')}
                        </Badge>
                        {getSeverityBadge(anomaly.severity)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {anomaly.baseline_value}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Baseline</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {anomaly.observed_value}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Observed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        +{anomaly.deviation_percentage}%
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Deviation</div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Affected Entities:
                    </h5>
                    <div className="flex flex-wrap gap-1">
                      {anomaly.affected_entities.map(entity => (
                        <Badge key={entity} variant="secondary" className="text-xs">
                          {entity}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Detected: {formatTimeAgo(anomaly.detection_time)}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="hunting" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Threat Hunting</h3>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" />
                New Hypothesis
              </Button>
            </div>

            <div className="space-y-4">
              {threatHunting.map(hunt => (
                <div key={hunt.id} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {hunt.hypothesis}
                        </h4>
                        {getStatusBadge(hunt.status)}
                      </div>
                    </div>
                    {getConfidenceBadge(hunt.confidence)}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-3">
                    <div>
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                        IOCs ({hunt.iocs.length})
                      </h5>
                      <div className="space-y-1">
                        {hunt.iocs.slice(0, 3).map(ioc => (
                          <div key={ioc} className="text-xs font-mono text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-1 rounded">
                            {ioc}
                          </div>
                        ))}
                        {hunt.iocs.length > 3 && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            +{hunt.iocs.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                        TTPs ({hunt.ttps.length})
                      </h5>
                      <div className="flex flex-wrap gap-1">
                        {hunt.ttps.map(ttp => (
                          <Badge key={ttp} variant="outline" className="text-xs">
                            {ttp}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                        Evidence
                      </h5>
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {hunt.evidence_count}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        pieces collected
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <span>Created: {formatTimeAgo(hunt.created_at)}</span>
                    <span>Updated: {formatTimeAgo(hunt.updated_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="models" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">ML Models</h3>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Bot className="w-4 h-4" />
                Active models
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {mlModels.map(model => (
                <div key={model.id} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {model.name}
                        </h4>
                        <Badge variant="outline" className="text-xs capitalize">
                          {model.type.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {model.description}
                      </p>
                    </div>
                    <Badge
                      className={
                        model.status === 'active' ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400' :
                        model.status === 'training' ? 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400' :
                        'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400'
                      }
                    >
                      {model.status}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Accuracy</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {Math.round(model.accuracy * 100)}%
                        </span>
                      </div>
                      <Progress value={model.accuracy * 100} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Training Data</span>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {model.training_data_size.toLocaleString()} samples
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Last Trained</span>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {formatTimeAgo(model.last_trained)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}