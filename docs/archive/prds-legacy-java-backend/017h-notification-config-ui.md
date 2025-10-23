# PRD-017h: Notification Config UI

**Priority:** P1 (User Workflow)
**Complexity:** Medium (Component)
**Type:** Unit PRD
**Parent:** PRD-017 (Alert and Notification System)
**Dependencies:** PRD-017a (NotificationConfigService)

## Problem

SREs need self-service UI to configure notification channels without backend code changes. Manual configuration via API calls is error-prone and slows incident response setup.

## Solution

Implement React component with forms for webhook, Slack, and email channel configuration. Include notification rule filters (severity, rule IDs, categories), quiet hours settings, and test notification button for validation.

## Unit Description

**File:** `bff/src/components/notifications/notification-config-page.tsx`
**Type:** React Component with shadcn/ui
**Purpose:** Self-service notification channel configuration UI

## Implementation

```typescript
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, Webhook, Mail, MessageSquare, Trash2, TestTube, Plus } from 'lucide-react';
import { demoApi } from '@/lib/api/demo-api';
import type { NotificationConfig } from '@/types/notifications';

export function NotificationConfigPage() {
  const [configs, setConfigs] = useState<NotificationConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<NotificationConfig | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    const data = await demoApi.getNotificationConfigs();
    setConfigs(data);
  };

  const handleSave = async () => {
    if (!selectedConfig) return;

    if (selectedConfig.id) {
      await demoApi.updateNotificationConfig(selectedConfig.id, selectedConfig);
    } else {
      await demoApi.createNotificationConfig(selectedConfig);
    }

    setIsEditing(false);
    loadConfigs();
  };

  const handleTest = async () => {
    if (!selectedConfig?.id) return;

    const result = await demoApi.testNotificationConfig(selectedConfig.id);
    setTestResult(result);

    setTimeout(() => setTestResult(null), 5000);
  };

  const handleDelete = async (id: string) => {
    await demoApi.deleteNotificationConfig(id);
    loadConfigs();
    setSelectedConfig(null);
  };

  const createNewConfig = (channelType: 'webhook' | 'slack' | 'email') => {
    setSelectedConfig({
      id: '',
      tenantId: '', // Populated by backend
      channelType,
      name: '',
      enabled: true,
      webhookUrl: channelType === 'webhook' ? '' : undefined,
      slackWebhookUrl: channelType === 'slack' ? '' : undefined,
      slackChannel: channelType === 'slack' ? '#alerts' : undefined,
      emailAddresses: channelType === 'email' ? [] : undefined,
      emailSmtpConfigJson: channelType === 'email' ? '{}' : undefined,
      notifyAll: true,
      severityFilter: [],
      ruleIds: [],
      categories: [],
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      quietHoursTimezone: 'UTC',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    setIsEditing(true);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="h-8 w-8" />
            Notification Channels
          </h1>
          <p className="text-muted-foreground">Configure alerts for signals</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => createNewConfig('webhook')} variant="outline">
            <Webhook className="h-4 w-4 mr-2" />
            Add Webhook
          </Button>
          <Button onClick={() => createNewConfig('slack')} variant="outline">
            <MessageSquare className="h-4 w-4 mr-2" />
            Add Slack
          </Button>
          <Button onClick={() => createNewConfig('email')} variant="outline">
            <Mail className="h-4 w-4 mr-2" />
            Add Email
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Config List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Channels</CardTitle>
            <CardDescription>{configs.length} configured</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {configs.map((config) => (
              <div
                key={config.id}
                className={`p-3 rounded-lg border cursor-pointer hover:bg-muted/50 ${
                  selectedConfig?.id === config.id ? 'border-primary bg-muted' : ''
                }`}
                onClick={() => {
                  setSelectedConfig(config);
                  setIsEditing(false);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {config.channelType === 'webhook' && <Webhook className="h-4 w-4" />}
                    {config.channelType === 'slack' && <MessageSquare className="h-4 w-4" />}
                    {config.channelType === 'email' && <Mail className="h-4 w-4" />}
                    <span className="font-medium">{config.name}</span>
                  </div>
                  <Badge variant={config.enabled ? 'default' : 'secondary'}>
                    {config.enabled ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {config.channelType === 'webhook' && 'Webhook'}
                  {config.channelType === 'slack' && `Slack: ${config.slackChannel}`}
                  {config.channelType === 'email' && `Email: ${config.emailAddresses?.length || 0} recipients`}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Right: Config Details */}
        {selectedConfig && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {isEditing ? 'Edit Configuration' : selectedConfig.name || 'New Configuration'}
                </CardTitle>
                <div className="flex gap-2">
                  {!isEditing && selectedConfig.id && (
                    <>
                      <Button onClick={handleTest} variant="outline" size="sm">
                        <TestTube className="h-4 w-4 mr-2" />
                        Test
                      </Button>
                      <Button onClick={() => setIsEditing(true)} size="sm">
                        Edit
                      </Button>
                      <Button
                        onClick={() => handleDelete(selectedConfig.id!)}
                        variant="destructive"
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {isEditing && (
                    <>
                      <Button onClick={() => setIsEditing(false)} variant="outline" size="sm">
                        Cancel
                      </Button>
                      <Button onClick={handleSave} size="sm">
                        Save
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {testResult && (
                <Alert variant={testResult.success ? 'default' : 'destructive'} className="mb-4">
                  <AlertDescription>{testResult.message}</AlertDescription>
                </Alert>
              )}

              <Tabs defaultValue="channel" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="channel">Channel</TabsTrigger>
                  <TabsTrigger value="rules">Rules</TabsTrigger>
                  <TabsTrigger value="schedule">Schedule</TabsTrigger>
                </TabsList>

                {/* Channel Configuration */}
                <TabsContent value="channel" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Configuration Name</Label>
                    <Input
                      id="name"
                      value={selectedConfig.name}
                      onChange={(e) =>
                        setSelectedConfig({ ...selectedConfig, name: e.target.value })
                      }
                      disabled={!isEditing}
                      placeholder="e.g., Production Alerts"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="enabled">Enabled</Label>
                    <Switch
                      id="enabled"
                      checked={selectedConfig.enabled}
                      onCheckedChange={(enabled) =>
                        setSelectedConfig({ ...selectedConfig, enabled })
                      }
                      disabled={!isEditing}
                    />
                  </div>

                  {selectedConfig.channelType === 'webhook' && (
                    <div className="space-y-2">
                      <Label htmlFor="webhookUrl">Webhook URL</Label>
                      <Input
                        id="webhookUrl"
                        value={selectedConfig.webhookUrl || ''}
                        onChange={(e) =>
                          setSelectedConfig({ ...selectedConfig, webhookUrl: e.target.value })
                        }
                        disabled={!isEditing}
                        placeholder="https://hooks.example.com/webhook"
                      />
                    </div>
                  )}

                  {selectedConfig.channelType === 'slack' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="slackWebhookUrl">Slack Webhook URL</Label>
                        <Input
                          id="slackWebhookUrl"
                          value={selectedConfig.slackWebhookUrl || ''}
                          onChange={(e) =>
                            setSelectedConfig({ ...selectedConfig, slackWebhookUrl: e.target.value })
                          }
                          disabled={!isEditing}
                          placeholder="https://hooks.slack.com/services/..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="slackChannel">Slack Channel</Label>
                        <Input
                          id="slackChannel"
                          value={selectedConfig.slackChannel || ''}
                          onChange={(e) =>
                            setSelectedConfig({ ...selectedConfig, slackChannel: e.target.value })
                          }
                          disabled={!isEditing}
                          placeholder="#alerts"
                        />
                      </div>
                    </>
                  )}

                  {selectedConfig.channelType === 'email' && (
                    <div className="space-y-2">
                      <Label htmlFor="emailAddresses">Email Addresses (comma-separated)</Label>
                      <Input
                        id="emailAddresses"
                        value={selectedConfig.emailAddresses?.join(', ') || ''}
                        onChange={(e) =>
                          setSelectedConfig({
                            ...selectedConfig,
                            emailAddresses: e.target.value.split(',').map((s) => s.trim()),
                          })
                        }
                        disabled={!isEditing}
                        placeholder="alerts@example.com, oncall@example.com"
                      />
                    </div>
                  )}
                </TabsContent>

                {/* Notification Rules */}
                <TabsContent value="rules" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notifyAll">Notify for All Signals</Label>
                    <Switch
                      id="notifyAll"
                      checked={selectedConfig.notifyAll}
                      onCheckedChange={(notifyAll) =>
                        setSelectedConfig({ ...selectedConfig, notifyAll })
                      }
                      disabled={!isEditing}
                    />
                  </div>

                  {!selectedConfig.notifyAll && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="severityFilter">Severity Filter</Label>
                        <Select
                          disabled={!isEditing}
                          onValueChange={(value) =>
                            setSelectedConfig({
                              ...selectedConfig,
                              severityFilter: value ? [value] : [],
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select minimum severity" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="critical">Critical</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="categories">Categories (comma-separated)</Label>
                        <Input
                          id="categories"
                          value={selectedConfig.categories?.join(', ') || ''}
                          onChange={(e) =>
                            setSelectedConfig({
                              ...selectedConfig,
                              categories: e.target.value.split(',').map((s) => s.trim()),
                            })
                          }
                          disabled={!isEditing}
                          placeholder="authentication, pii, compliance"
                        />
                      </div>
                    </>
                  )}
                </TabsContent>

                {/* Quiet Hours */}
                <TabsContent value="schedule" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="quietHoursEnabled">Enable Quiet Hours</Label>
                    <Switch
                      id="quietHoursEnabled"
                      checked={selectedConfig.quietHoursEnabled}
                      onCheckedChange={(quietHoursEnabled) =>
                        setSelectedConfig({ ...selectedConfig, quietHoursEnabled })
                      }
                      disabled={!isEditing}
                    />
                  </div>

                  {selectedConfig.quietHoursEnabled && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="quietHoursStart">Start Time (HH:MM)</Label>
                        <Input
                          id="quietHoursStart"
                          type="time"
                          value={selectedConfig.quietHoursStart}
                          onChange={(e) =>
                            setSelectedConfig({ ...selectedConfig, quietHoursStart: e.target.value })
                          }
                          disabled={!isEditing}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quietHoursEnd">End Time (HH:MM)</Label>
                        <Input
                          id="quietHoursEnd"
                          type="time"
                          value={selectedConfig.quietHoursEnd}
                          onChange={(e) =>
                            setSelectedConfig({ ...selectedConfig, quietHoursEnd: e.target.value })
                          }
                          disabled={!isEditing}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quietHoursTimezone">Timezone</Label>
                        <Input
                          id="quietHoursTimezone"
                          value={selectedConfig.quietHoursTimezone}
                          onChange={(e) =>
                            setSelectedConfig({ ...selectedConfig, quietHoursTimezone: e.target.value })
                          }
                          disabled={!isEditing}
                          placeholder="UTC"
                        />
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
```

## Architecture Integration

**ADR-011 (TigerBeetle-First):** UI only - data persisted via NotificationConfigService
**ADR-013 (Camel-First):** Not applicable (frontend component)
**ADR-014 (Named Processors):** Not applicable (frontend component)
**ADR-015 (Tiered Storage):** Notification configs stored in DuckDB

## Type Definitions

```typescript
// bff/src/types/notifications.ts
export interface NotificationConfig {
  id: string;
  tenantId: string;
  channelType: 'webhook' | 'slack' | 'email';
  name: string;
  enabled: boolean;

  // Webhook
  webhookUrl?: string;

  // Slack
  slackWebhookUrl?: string;
  slackChannel?: string;

  // Email
  emailAddresses?: string[];
  emailSmtpConfigJson?: string;

  // Notification rules
  notifyAll: boolean;
  severityFilter?: string[];
  ruleIds?: string[];
  categories?: string[];

  // Quiet hours
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  quietHoursTimezone: string;

  createdAt: Date;
  updatedAt: Date;
}
```

## API Integration

```typescript
// bff/src/lib/api/demo-api.ts
export const demoApi = {
  async getNotificationConfigs(): Promise<NotificationConfig[]> {
    const response = await fetch('/api/notifications/configs');
    return response.json();
  },

  async createNotificationConfig(config: NotificationConfig): Promise<NotificationConfig> {
    const response = await fetch('/api/notifications/configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return response.json();
  },

  async updateNotificationConfig(id: string, config: NotificationConfig): Promise<NotificationConfig> {
    const response = await fetch(`/api/notifications/configs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return response.json();
  },

  async deleteNotificationConfig(id: string): Promise<void> {
    await fetch(`/api/notifications/configs/${id}`, { method: 'DELETE' });
  },

  async testNotificationConfig(id: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`/api/notifications/configs/${id}/test`, { method: 'POST' });
    return response.json();
  },
};
```

## Test Requirements (QA Expert)

**Unit Tests:**
- testRender_NoConfigs - empty state renders correctly
- testRender_WithConfigs - list of configs renders
- testSelectConfig_DisplaysDetails - clicking config shows details
- testCreateWebhook_OpensForm - clicking Add Webhook opens form
- testCreateSlack_OpensForm - clicking Add Slack opens form
- testCreateEmail_OpensForm - clicking Add Email opens form
- testEditConfig_EnablesFields - clicking Edit enables inputs
- testSaveConfig_CallsAPI - saving calls POST/PUT API
- testDeleteConfig_CallsAPI - deleting calls DELETE API
- testTestConfig_DisplaysResult - test button shows success/failure
- testQuietHours_DisabledByDefault - quiet hours fields hidden when disabled
- testQuietHours_ShowsFields - quiet hours fields visible when enabled
- testNotifyAll_DisablesFilters - notifyAll=true hides severity/category filters

**Integration Tests:**
- testFullWorkflow_CreateAndTest - create config → test → verify delivery

**Test Coverage:** 90% minimum (ADR-014)

## Security Considerations (Security Expert)

**Threats & Mitigations:**
- Webhook URL injection - mitigate with URL validation on backend
- Email address injection - mitigate with RFC 5322 validation on backend
- SMTP credential leakage - mitigate by NOT displaying SMTP config in UI
- SSRF via webhook URL - mitigate with backend URL validation (block private IPs)

**Compliance:**
- SOC2 CC7.2 (System Monitoring) - UI enables notification configuration for incident communication

## Success Criteria

- [ ] Render list of notification configs
- [ ] Support webhook, Slack, email channel types
- [ ] Configuration form with all fields (webhook URL, Slack webhook, email addresses)
- [ ] Notification rules (notify all, severity filter, categories)
- [ ] Quiet hours configuration (start, end, timezone)
- [ ] Enable/disable toggle for each config
- [ ] Test notification button
- [ ] Delete configuration button
- [ ] All tests pass with 90% coverage
