import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Shield,
  Globe,
  AlertTriangle,
  Info,
  ExternalLink,
  Search,
  Database,
  Activity,
  Users,
  MapPin,
  Hash,
  Calendar,
  Zap,
  Target,
  Eye,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react'
import { DemoSignal } from '@/lib/api/demo-api'

interface ThreatIntelligence {
  id: string
  source: string
  type: 'ip' | 'domain' | 'hash' | 'url' | 'email' | 'user_agent'
  value: string
  confidence: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  reputation_score: number
  first_seen: string
  last_seen: string
  tags: string[]
  description: string
  details: {
    geolocation?: {
      country: string
      city: string
      latitude: number
      longitude: number
    }
    whois?: {
      registrar: string
      creation_date: string
      expiration_date: string
    }
    malware_families?: string[]
    attack_types?: string[]
    campaigns?: string[]
  }
  references: {
    url: string
    title: string
    date: string
  }[]
}

interface ThreatSource {
  id: string
  name: string
  type: 'commercial' | 'open_source' | 'government' | 'community'
  status: 'active' | 'inactive' | 'error'
  last_updated: string
  coverage: string[]
  reputation: number
}

interface SignalThreatIntelligenceProps {
  signal: DemoSignal
  className?: string
}

export function SignalThreatIntelligence({ signal, className }: SignalThreatIntelligenceProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [threatIntel, setThreatIntel] = useState<ThreatIntelligence[]>([])
  const [sources, setSources] = useState<ThreatSource[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  // Mock threat intelligence sources
  const mockSources: ThreatSource[] = [
    {
      id: 'virustotal',
      name: 'VirusTotal',
      type: 'commercial',
      status: 'active',
      last_updated: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      coverage: ['ip', 'domain', 'hash', 'url'],
      reputation: 95
    },
    {
      id: 'misp',
      name: 'MISP Platform',
      type: 'community',
      status: 'active',
      last_updated: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      coverage: ['ip', 'domain', 'hash', 'email'],
      reputation: 88
    },
    {
      id: 'alienvault',
      name: 'AlienVault OTX',
      type: 'open_source',
      status: 'active',
      last_updated: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      coverage: ['ip', 'domain', 'hash', 'url'],
      reputation: 82
    },
    {
      id: 'threatconnect',
      name: 'ThreatConnect',
      type: 'commercial',
      status: 'active',
      last_updated: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      coverage: ['ip', 'domain', 'hash', 'email'],
      reputation: 91
    },
    {
      id: 'crowdstrike',
      name: 'CrowdStrike Falcon',
      type: 'commercial',
      status: 'error',
      last_updated: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      coverage: ['hash', 'ip', 'domain'],
      reputation: 97
    }
  ]

  // Generate mock threat intelligence data
  const generateThreatIntel = (): ThreatIntelligence[] => {
    return [
      {
        id: 'intel-1',
        source: 'VirusTotal',
        type: 'ip',
        value: '203.0.113.42',
        confidence: 87,
        severity: 'high',
        reputation_score: 15,
        first_seen: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        last_seen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        tags: ['botnet', 'malware-c2', 'suspicious'],
        description: 'IP address associated with known botnet command and control infrastructure',
        details: {
          geolocation: {
            country: 'Russian Federation',
            city: 'Moscow',
            latitude: 55.7558,
            longitude: 37.6176
          },
          attack_types: ['botnet', 'data-exfiltration', 'ddos'],
          campaigns: ['APT-2023-001', 'Lazarus-Group']
        },
        references: [
          {
            url: 'https://blog.virustotal.com/threat-report-q3-2023',
            title: 'Q3 2023 Threat Intelligence Report',
            date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
          }
        ]
      },
      {
        id: 'intel-2',
        source: 'MISP',
        type: 'domain',
        value: 'malicious-domain.example',
        confidence: 92,
        severity: 'critical',
        reputation_score: 8,
        first_seen: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        last_seen: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        tags: ['phishing', 'credential-theft', 'active'],
        description: 'Domain hosting phishing pages targeting financial institutions',
        details: {
          whois: {
            registrar: 'Malicious Registrar Inc.',
            creation_date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
            expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          },
          attack_types: ['phishing', 'credential-harvesting'],
          campaigns: ['FinPhish-2023']
        },
        references: [
          {
            url: 'https://misp-community.org/galaxy.html#_fin_phish_campaign',
            title: 'FinPhish Campaign Analysis',
            date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
          }
        ]
      },
      {
        id: 'intel-3',
        source: 'AlienVault OTX',
        type: 'hash',
        value: 'a1b2c3d4e5f6...',
        confidence: 95,
        severity: 'critical',
        reputation_score: 5,
        first_seen: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        last_seen: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        tags: ['ransomware', 'trojan', 'windows'],
        description: 'Known ransomware payload hash with multiple detections',
        details: {
          malware_families: ['LockBit', 'Conti'],
          attack_types: ['ransomware', 'data-encryption'],
          campaigns: ['LockBit-3.0']
        },
        references: [
          {
            url: 'https://otx.alienvault.com/pulse/lockbit-ransomware',
            title: 'LockBit Ransomware Analysis',
            date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
          }
        ]
      }
    ]
  }

  useEffect(() => {
    setSources(mockSources)
  }, [])

  const enrichSignal = async () => {
    setIsLoading(true)

    // Simulate API calls to threat intelligence sources
    await new Promise(resolve => setTimeout(resolve, 2000))

    const mockIntel = generateThreatIntel()
    setThreatIntel(mockIntel)
    setIsLoading(false)
  }

  useEffect(() => {
    if (isOpen) {
      enrichSignal()
    }
  }, [isOpen])

  const getSourceStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'error': return <XCircle className="w-4 h-4 text-red-600" />
      default: return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100 border-red-200'
      case 'high': return 'text-orange-600 bg-orange-100 border-orange-200'
      case 'medium': return 'text-yellow-600 bg-yellow-100 border-yellow-200'
      case 'low': return 'text-blue-600 bg-blue-100 border-blue-200'
      default: return 'text-gray-600 bg-gray-100 border-gray-200'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'ip': return <MapPin className="w-4 h-4" />
      case 'domain': return <Globe className="w-4 h-4" />
      case 'hash': return <Hash className="w-4 h-4" />
      case 'url': return <ExternalLink className="w-4 h-4" />
      case 'email': return <Users className="w-4 h-4" />
      default: return <Info className="w-4 h-4" />
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays > 0) {
      return `${diffDays}d ago`
    } else if (diffHours > 0) {
      return `${diffHours}h ago`
    } else {
      return 'Recently'
    }
  }

  const hasThreats = threatIntel.some(intel => intel.severity === 'high' || intel.severity === 'critical')

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className={className}>
            <Shield className="w-4 h-4 mr-2" />
            Threat Intelligence
            {hasThreats && (
              <Badge variant="destructive" className="ml-2">
                {threatIntel.filter(i => i.severity === 'high' || i.severity === 'critical').length}
              </Badge>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Threat Intelligence Enrichment</DialogTitle>
            <DialogDescription>
              External threat intelligence data for signal {signal.id} from multiple sources.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="details">Detailed Analysis</TabsTrigger>
                <TabsTrigger value="sources">Sources</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Enriching signal with threat intelligence...</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="p-4 text-center">
                          <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                          <div className="text-2xl font-bold text-red-600">
                            {threatIntel.filter(i => i.severity === 'high' || i.severity === 'critical').length}
                          </div>
                          <div className="text-sm text-gray-600">High Risk Indicators</div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4 text-center">
                          <Database className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                          <div className="text-2xl font-bold text-blue-600">{threatIntel.length}</div>
                          <div className="text-sm text-gray-600">Total Indicators</div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4 text-center">
                          <Target className="w-8 h-8 text-green-600 mx-auto mb-2" />
                          <div className="text-2xl font-bold text-green-600">
                            {threatIntel.length > 0 ? Math.round(threatIntel.reduce((acc, intel) => acc + intel.confidence, 0) / threatIntel.length) : 0}%
                          </div>
                          <div className="text-sm text-gray-600">Avg Confidence</div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Threat Intelligence Results */}
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold">Intelligence Results</h3>
                      {threatIntel.length === 0 ? (
                        <Card>
                          <CardContent className="p-6 text-center">
                            <Shield className="w-12 h-12 text-green-600 mx-auto mb-4" />
                            <h4 className="text-lg font-semibold text-green-600 mb-2">No Threats Detected</h4>
                            <p className="text-gray-600">This signal does not match any known threat indicators.</p>
                          </CardContent>
                        </Card>
                      ) : (
                        threatIntel.map(intel => (
                          <Card key={intel.id} className="border-l-4 border-l-red-500">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    {getTypeIcon(intel.type)}
                                    <h4 className="font-semibold">{intel.value}</h4>
                                    <Badge className={getSeverityColor(intel.severity)}>
                                      {intel.severity.toUpperCase()}
                                    </Badge>
                                    <Badge variant="outline">
                                      {intel.confidence}% confidence
                                    </Badge>
                                  </div>

                                  <p className="text-sm text-gray-600 mb-3">{intel.description}</p>

                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                    <div>
                                      <span className="font-medium text-gray-500">Source:</span>
                                      <div>{intel.source}</div>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-500">First Seen:</span>
                                      <div>{formatTimestamp(intel.first_seen)}</div>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-500">Last Seen:</span>
                                      <div>{formatTimestamp(intel.last_seen)}</div>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-500">Reputation:</span>
                                      <div className="flex items-center gap-1">
                                        <Progress value={intel.reputation_score} className="w-12 h-2" />
                                        <span>{intel.reputation_score}/100</span>
                                      </div>
                                    </div>
                                  </div>

                                  {intel.tags.length > 0 && (
                                    <div className="mt-3">
                                      <div className="flex flex-wrap gap-1">
                                        {intel.tags.map(tag => (
                                          <Badge key={tag} variant="secondary" className="text-xs">
                                            {tag}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <Button variant="ghost" size="sm">
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </>
                )}
              </TabsContent>

              {/* Details Tab */}
              <TabsContent value="details" className="space-y-4">
                <div className="space-y-4">
                  {threatIntel.map(intel => (
                    <Card key={`detail-${intel.id}`}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          {getTypeIcon(intel.type)}
                          {intel.value}
                          <Badge className={getSeverityColor(intel.severity)}>
                            {intel.severity}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Geolocation */}
                        {intel.details.geolocation && (
                          <div>
                            <h4 className="font-semibold mb-2 flex items-center gap-2">
                              <MapPin className="w-4 h-4" />
                              Geolocation
                            </h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>Country: {intel.details.geolocation.country}</div>
                              <div>City: {intel.details.geolocation.city}</div>
                            </div>
                          </div>
                        )}

                        {/* Attack Types */}
                        {intel.details.attack_types && (
                          <div>
                            <h4 className="font-semibold mb-2">Attack Types</h4>
                            <div className="flex flex-wrap gap-2">
                              {intel.details.attack_types.map(type => (
                                <Badge key={type} variant="destructive">{type}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Campaigns */}
                        {intel.details.campaigns && (
                          <div>
                            <h4 className="font-semibold mb-2">Associated Campaigns</h4>
                            <div className="flex flex-wrap gap-2">
                              {intel.details.campaigns.map(campaign => (
                                <Badge key={campaign} variant="outline">{campaign}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* References */}
                        {intel.references.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-2">References</h4>
                            <div className="space-y-2">
                              {intel.references.map((ref, index) => (
                                <div key={index} className="flex items-center gap-2 text-sm">
                                  <ExternalLink className="w-3 h-3" />
                                  <a href={ref.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                    {ref.title}
                                  </a>
                                  <span className="text-gray-500">• {formatTimestamp(ref.date)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* Sources Tab */}
              <TabsContent value="sources" className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Intelligence Sources</h3>
                    <Button variant="outline" onClick={enrichSignal} disabled={isLoading}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh All
                    </Button>
                  </div>

                  {sources.map(source => (
                    <Card key={source.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getSourceStatusIcon(source.status)}
                            <div>
                              <h4 className="font-semibold">{source.name}</h4>
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Badge variant="outline" className="text-xs">
                                  {source.type}
                                </Badge>
                                <span>Coverage: {source.coverage.join(', ')}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <div className="font-medium">Reputation: {source.reputation}%</div>
                            <div className="text-gray-500">Updated {formatTimestamp(source.last_updated)}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsOpen(false)} className="flex-1">
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}