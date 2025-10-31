import React, { useState, useEffect } from 'react';
import { AppRootProps } from '@grafana/data';
import { VerticalGroup, Alert } from '@grafana/ui';
import { RuleList } from '../components/RuleList';
import { MonacoRuleEditor } from '../components/MonacoRuleEditor';
import { useEffectCallback } from '../hooks/useEffect';
import type { Rule } from '../services/BeTraceService';

type View = 'list' | 'create' | 'edit';

/**
 * RulesPage - Rule management interface (Effect-based)
 *
 * Create, edit, and manage BeTraceDSL rules for trace pattern matching.
 * Uses Effect for all API operations with automatic retry and error handling.
 */
export const RulesPage: React.FC<Partial<AppRootProps>> = () => {
  const [currentView, setCurrentView] = useState<View>('list');
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);

  // Fetch rule for editing using Effect
  const fetchRule = useEffectCallback(
    (service, id: string) => service.getRule(id),
    {
      onSuccess: (rule) => setSelectedRule(rule),
      onError: (error) => console.error('Failed to fetch rule:', error),
    }
  );

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
          <h1>Rules - BeTraceDSL Management</h1>
          <p style={{ color: '#888', fontSize: '14px' }}>
            Create and manage behavioral pattern matching rules for distributed traces
          </p>
        </div>

        {currentView === 'list' && (
          <RuleList
            onCreateRule={handleCreateRule}
            onEditRule={handleEditRule}
          />
        )}

        {(currentView === 'create' || currentView === 'edit') && (
          <MonacoRuleEditor
            rule={selectedRule}
            onSave={handleSave}
            onCancel={handleCancel}
            onTest={handleTestExpression}
          />
        )}
      </VerticalGroup>
    </div>
  );
};
