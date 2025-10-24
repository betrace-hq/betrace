import React, { useState } from 'react';
import { AppRootProps } from '@grafana/data';
import { Alert, VerticalGroup } from '@grafana/ui';
import { RuleList } from '../components/RuleList';
import { RuleEditor } from '../components/RuleEditor';

type View = 'list' | 'create' | 'edit';

interface Rule {
  id?: string;
  name: string;
  description: string;
  pattern: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * RootPage - Main entry point for BeTrace plugin
 *
 * Phase 2: Full rule management with list/create/edit views
 */
export const RootPage: React.FC<AppRootProps> = () => {
  const [currentView, setCurrentView] = useState<View>('list');
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);

  // Backend URL - TODO: make configurable via plugin settings
  const backendUrl = 'http://localhost:12011';

  // Navigation handlers
  const handleCreateRule = () => {
    setSelectedRule(null);
    setCurrentView('create');
  };

  const handleEditRule = (rule: Rule) => {
    setSelectedRule(rule);
    setCurrentView('edit');
  };

  const handleSave = () => {
    setSelectedRule(null);
    setCurrentView('list');
  };

  const handleCancel = () => {
    setSelectedRule(null);
    setCurrentView('list');
  };

  return (
    <div style={{ padding: '20px' }}>
      <VerticalGroup spacing="lg">
        <div>
          <h1>BeTrace - Behavioral Assurance for OpenTelemetry</h1>
          <p style={{ color: '#888', fontSize: '14px' }}>
            Create and manage trace pattern matching rules with BeTraceDSL
          </p>
        </div>

        {currentView === 'list' && (
          <RuleList
            onCreateRule={handleCreateRule}
            onEditRule={handleEditRule}
            backendUrl={backendUrl}
          />
        )}

        {(currentView === 'create' || currentView === 'edit') && (
          <RuleEditor
            rule={selectedRule}
            onSave={handleSave}
            onCancel={handleCancel}
            backendUrl={backendUrl}
          />
        )}

        {/* Footer info */}
        <div style={{ marginTop: '40px', fontSize: '12px', color: '#888', borderTop: '1px solid #333', paddingTop: '20px' }}>
          <p>
            <strong>ADR-027:</strong> BeTrace as Grafana App Plugin
            <br />
            <strong>Status:</strong> Phase 2 - Rule Management (CRUD operations completed)
            <br />
            <strong>Backend:</strong> {backendUrl}
          </p>
        </div>
      </VerticalGroup>
    </div>
  );
};
