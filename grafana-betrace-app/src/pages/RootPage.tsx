import React, { useState, useEffect } from 'react';
import { AppRootProps } from '@grafana/data';
import { Alert, VerticalGroup } from '@grafana/ui';
import { RuleList } from '../components/RuleList';
import { MonacoRuleEditor } from '../components/MonacoRuleEditor';

type View = 'list' | 'create' | 'edit';

interface Rule {
  id?: string;
  name: string;
  description: string;
  expression: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * RootPage - Main entry point for BeTrace plugin
 *
 * Phase 2: Full rule management with list/create/edit views
 */
export const RootPage: React.FC<AppRootProps> = ({ query }) => {
  const [currentView, setCurrentView] = useState<View>('list');
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);

  // Backend URL - TODO: make configurable via plugin settings
  const backendUrl = 'http://localhost:12011';

  // Read view from URL query params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view') as View;
    const ruleId = params.get('ruleId');

    if (view === 'create' || view === 'edit' || view === 'list') {
      setCurrentView(view);
    }

    // Clear selected rule if not editing
    if (view !== 'edit') {
      setSelectedRule(null);
    }

    // If editing, fetch the rule
    if (view === 'edit' && ruleId) {
      fetchRule(ruleId);
    }
  }, []);

  // Fetch rule for editing
  const fetchRule = async (id: string) => {
    try {
      const response = await fetch(`${backendUrl}/api/rules/${id}`);
      if (response.ok) {
        const rule = await response.json();
        setSelectedRule(rule);
      }
    } catch (err) {
      console.error('Failed to fetch rule:', err);
    }
  };

  // Update URL when view changes
  const updateURL = (view: View, ruleId?: string) => {
    const params = new URLSearchParams();
    params.set('view', view);
    if (ruleId) {
      params.set('ruleId', ruleId);
    }
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, '', newUrl);
  };

  // Navigation handlers
  const handleCreateRule = () => {
    setSelectedRule(null);
    setCurrentView('create');
    updateURL('create');
  };

  const handleEditRule = (rule: Rule) => {
    setSelectedRule(rule);
    setCurrentView('edit');
    updateURL('edit', rule.id);
  };

  const handleSave = () => {
    setSelectedRule(null);
    setCurrentView('list');
    updateURL('list');
  };

  const handleCancel = () => {
    setSelectedRule(null);
    setCurrentView('list');
    updateURL('list');
  };

  // Expression testing (basic validation)
  const handleTestExpression = async (expression: string): Promise<{ valid: boolean; error?: string }> => {
    // Basic syntax validation
    const hasKeywords = /trace\.|span\.|has\(|and|or|not/.test(expression);
    if (!hasKeywords) {
      return {
        valid: false,
        error: 'Expression should contain BeTraceDSL keywords (trace., span., has(), and, or, not)',
      };
    }

    // Check for balanced parentheses
    const openParens = (expression.match(/\(/g) || []).length;
    const closeParens = (expression.match(/\)/g) || []).length;
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
            onTest={handleTestExpression}
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
