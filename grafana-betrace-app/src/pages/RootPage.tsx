import React, { useState } from 'react';
import { AppRootProps } from '@grafana/data';
import { Alert, VerticalGroup } from '@grafana/ui';
import { RuleList } from '../components/RuleList';
import { MonacoRuleEditor } from '../components/MonacoRuleEditor';

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

  // Pattern testing (basic validation)
  const handleTestPattern = async (pattern: string): Promise<{ valid: boolean; error?: string }> => {
    // Basic syntax validation
    const hasKeywords = /trace\.|span\.|has\(|and|or|not/.test(pattern);
    if (!hasKeywords) {
      return {
        valid: false,
        error: 'Pattern should contain BeTraceDSL keywords (trace., span., has(), and, or, not)',
      };
    }

    // Check for balanced parentheses
    const openParens = (pattern.match(/\(/g) || []).length;
    const closeParens = (pattern.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      return {
        valid: false,
        error: `Unbalanced parentheses: ${openParens} opening, ${closeParens} closing`,
      };
    }

    return { valid: true };
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
          <MonacoRuleEditor
            rule={selectedRule}
            onSave={handleSave}
            onCancel={handleCancel}
            onTest={handleTestPattern}
            backendUrl={backendUrl}
          />
        )}

        {/* Footer info */}
        <div style={{ marginTop: '40px', fontSize: '12px', color: '#888', borderTop: '1px solid #333', paddingTop: '20px' }}>
          <p>
            <strong>ADR-027:</strong> BeTrace as Grafana App Plugin
            <br />
            <strong>Status:</strong> Phase 3 - Monaco Editor (Production Ready)
            <br />
            <strong>Backend:</strong> {backendUrl}
          </p>
        </div>
      </VerticalGroup>
    </div>
  );
};
