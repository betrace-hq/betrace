import type { Meta, StoryObj } from '@storybook/react';
import { MetadataGrid } from '@/components/ui/metadata-grid';
import { TechnicalContext } from '@/components/ui/technical-context';
import { SignalActions } from '@/components/ui/signal-actions';
import { RelatedSignals } from '@/components/ui/related-signals';
import { StyledCard, CardContent, CardHeader, CardTitle } from '@/components/ui/styled-card';
import { Hash, Tag, Shield, Activity, Calendar, Database } from 'lucide-react';

const meta: Meta = {
  title: 'BeTrace/Signal Detail Components',
};

export default meta;
type Story = StoryObj<typeof meta>;

export const MetadataGridExample: Story = {
  name: 'Metadata Grid',
  render: () => (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold">Metadata Grid</h3>
      <p className="text-gray-600 dark:text-gray-400">
        Displays key-value metadata in a clean, responsive grid layout.
      </p>

      <StyledCard>
        <CardHeader>
          <CardTitle>Signal Details</CardTitle>
        </CardHeader>
        <CardContent>
          <MetadataGrid
            items={[
              {
                label: 'Signal ID',
                value: 'signal-001',
                icon: Hash,
                mono: true,
              },
              {
                label: 'Rule Triggered',
                value: 'Suspicious Activity Detection',
                icon: Shield,
              },
              {
                label: 'Confidence Score',
                value: (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">87%</span>
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 max-w-[100px]">
                      <div className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full" style={{ width: '87%' }} />
                    </div>
                  </div>
                ),
              },
              {
                label: 'Impact',
                value: 'Service Disruption',
                badge: 'outline',
              },
              {
                label: 'Service',
                value: 'Auth Service',
                icon: Database,
              },
              {
                label: 'Detected At',
                value: new Date().toLocaleString(),
                icon: Calendar,
              },
            ]}
            columns={2}
          />
        </CardContent>
      </StyledCard>

      <StyledCard>
        <CardHeader>
          <CardTitle>With Tags (Full Width)</CardTitle>
        </CardHeader>
        <CardContent>
          <MetadataGrid
            items={[
              {
                label: 'Signal ID',
                value: 'signal-001',
                mono: true,
              },
              {
                label: 'Service',
                value: 'API Gateway',
              },
              {
                label: 'Tags',
                value: (
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
                      authentication
                    </span>
                    <span className="px-2 py-1 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded">
                      brute-force
                    </span>
                    <span className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded">
                      security
                    </span>
                  </div>
                ),
                fullWidth: true,
              },
            ]}
            columns={2}
          />
        </CardContent>
      </StyledCard>
    </div>
  ),
};

export const TechnicalContextExample: Story = {
  name: 'Technical Context',
  render: () => (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold">Technical Context</h3>
      <p className="text-gray-600 dark:text-gray-400">
        Shows OpenTelemetry trace context and technical metadata. Links to external tracing systems.
      </p>

      <StyledCard>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Technical Context
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TechnicalContext
            traceId="a1b2c3d4e5f6g7h8"
            correlationId="corr-signal-001"
            spanId="span-9i8j7k6l"
            metadata={{
              source_ip: '192.168.1.100',
              request_method: 'POST',
              endpoint: '/api/v1/admin/users',
              response_code: 403,
              user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            }}
            tracingUrl="https://jaeger.example.com/trace/a1b2c3d4e5f6g7h8"
          />
        </CardContent>
      </StyledCard>

      <StyledCard>
        <CardHeader>
          <CardTitle>Minimal Context</CardTitle>
        </CardHeader>
        <CardContent>
          <TechnicalContext
            correlationId="corr-signal-002"
            metadata={{
              source_ip: '10.0.0.50',
            }}
          />
        </CardContent>
      </StyledCard>
    </div>
  ),
};

export const SignalActionsExample: Story = {
  name: 'Signal Actions',
  render: () => (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold">Signal Actions</h3>
      <p className="text-gray-600 dark:text-gray-400">
        Action buttons and quick note input for signal investigation workflow.
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        <StyledCard>
          <CardHeader>
            <CardTitle>Open Signal</CardTitle>
          </CardHeader>
          <CardContent>
            <SignalActions
              status="open"
              canEdit={true}
              onStatusChange={(action) => console.log('Status change:', action)}
              onAddNote={(note) => console.log('Note added:', note)}
            />
          </CardContent>
        </StyledCard>

        <StyledCard>
          <CardHeader>
            <CardTitle>Investigating</CardTitle>
          </CardHeader>
          <CardContent>
            <SignalActions
              status="investigating"
              canEdit={true}
              onStatusChange={(action) => console.log('Status change:', action)}
              onAddNote={(note) => console.log('Note added:', note)}
            />
          </CardContent>
        </StyledCard>

        <StyledCard>
          <CardHeader>
            <CardTitle>Resolved</CardTitle>
          </CardHeader>
          <CardContent>
            <SignalActions
              status="resolved"
              canEdit={true}
            />
          </CardContent>
        </StyledCard>

        <StyledCard>
          <CardHeader>
            <CardTitle>No Permission</CardTitle>
          </CardHeader>
          <CardContent>
            <SignalActions
              status="open"
              canEdit={false}
            />
          </CardContent>
        </StyledCard>
      </div>
    </div>
  ),
};

export const RelatedSignalsExample: Story = {
  name: 'Related Signals',
  render: () => (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold">Related Signals</h3>
      <p className="text-gray-600 dark:text-gray-400">
        Shows signals related by service, trace, rule, or time correlation.
      </p>

      <StyledCard>
        <CardHeader>
          <CardTitle>Related Signals</CardTitle>
        </CardHeader>
        <CardContent>
          <RelatedSignals
            enableLinks={false}
            signals={[
              {
                id: 'signal-002',
                title: 'High error rate detected',
                service: 'Auth Service',
                severity: 'HIGH',
                status: 'investigating',
                timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
                relation: 'same-service',
              },
              {
                id: 'signal-003',
                title: 'Database connection timeout',
                service: 'User Service',
                severity: 'MEDIUM',
                status: 'open',
                timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
                relation: 'same-trace',
              },
              {
                id: 'signal-004',
                title: 'Unusual login pattern',
                service: 'Auth Service',
                severity: 'CRITICAL',
                status: 'open',
                timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
                relation: 'same-rule',
              },
              {
                id: 'signal-005',
                title: 'API rate limit exceeded',
                service: 'API Gateway',
                severity: 'LOW',
                status: 'resolved',
                timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
                relation: 'time-correlation',
              },
            ]}
            limit={3}
          />
        </CardContent>
      </StyledCard>

      <StyledCard>
        <CardHeader>
          <CardTitle>No Related Signals</CardTitle>
        </CardHeader>
        <CardContent>
          <RelatedSignals enableLinks={false} signals={[]} />
        </CardContent>
      </StyledCard>

      <StyledCard>
        <CardHeader>
          <CardTitle>Loading State</CardTitle>
        </CardHeader>
        <CardContent>
          <RelatedSignals signals={[]} isLoading={true} />
        </CardContent>
      </StyledCard>
    </div>
  ),
};

export const CompleteSignalDetailLayout: Story = {
  name: 'Complete Signal Detail Layout',
  render: () => (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold mb-8">Signal Detail Page Layout</h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Details */}
          <div className="lg:col-span-2 space-y-6">
            <StyledCard>
              <CardHeader>
                <CardTitle>Signal Details</CardTitle>
              </CardHeader>
              <CardContent>
                <MetadataGrid
                  items={[
                    { label: 'Signal ID', value: 'signal-001', mono: true },
                    { label: 'Rule', value: 'Suspicious Activity Detection' },
                    { label: 'Confidence', value: '87%' },
                    { label: 'Impact', value: 'Service Disruption', badge: 'outline' },
                  ]}
                  columns={2}
                />
              </CardContent>
            </StyledCard>

            <StyledCard>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Technical Context
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TechnicalContext
                  traceId="a1b2c3d4e5f6g7h8"
                  correlationId="corr-signal-001"
                  metadata={{
                    source_ip: '192.168.1.100',
                    request_method: 'POST',
                    response_code: 403,
                  }}
                  tracingUrl="https://jaeger.example.com/trace/a1b2c3d4e5f6g7h8"
                />
              </CardContent>
            </StyledCard>
          </div>

          {/* Right Column - Actions & Related */}
          <div className="space-y-6">
            <StyledCard>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SignalActions
                  status="open"
                  canEdit={true}
                  onStatusChange={(action) => console.log('Action:', action)}
                  onAddNote={(note) => console.log('Note:', note)}
                />
              </CardContent>
            </StyledCard>

            <StyledCard>
              <CardHeader>
                <CardTitle>Related Signals</CardTitle>
              </CardHeader>
              <CardContent>
                <RelatedSignals
                  enableLinks={false}
                  signals={[
                    {
                      id: 'signal-002',
                      title: 'High error rate',
                      service: 'Auth Service',
                      severity: 'HIGH',
                      status: 'investigating',
                      timestamp: new Date().toISOString(),
                      relation: 'same-service',
                    },
                    {
                      id: 'signal-003',
                      title: 'Database timeout',
                      service: 'User Service',
                      severity: 'MEDIUM',
                      status: 'open',
                      timestamp: new Date().toISOString(),
                      relation: 'same-trace',
                    },
                  ]}
                />
              </CardContent>
            </StyledCard>
          </div>
        </div>
      </div>
    </div>
  ),
};
