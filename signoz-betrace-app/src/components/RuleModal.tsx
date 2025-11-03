/**
 * Rule Creation/Edit Modal
 *
 * Features:
 * - Create new rules
 * - Edit existing rules
 * - Monaco editor for DSL
 * - Real-time validation
 * - Rule templates
 */

import { useState, useEffect } from 'react';
import { MonacoEditor } from './MonacoEditor';

export interface Rule {
  id?: string;
  name: string;
  description: string;
  dsl: string;
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface RuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rule: Omit<Rule, 'id'>) => Promise<void>;
  rule?: Rule;  // If provided, edit mode; otherwise, create mode
}

const RULE_TEMPLATES = [
  {
    name: 'Slow Database Query',
    description: 'Detect database queries that exceed 1 second',
    dsl: 'span.duration > 1000000000 AND span.attributes["db.system"] EXISTS',
    severity: 'medium' as const,
  },
  {
    name: 'HTTP 5xx Errors',
    description: 'Detect server errors (HTTP 500-599)',
    dsl: 'span.attributes["http.status_code"] >= 500',
    severity: 'high' as const,
  },
  {
    name: 'Unauthorized Access',
    description: 'Detect 401 unauthorized access attempts',
    dsl: 'span.attributes["http.status_code"] == 401',
    severity: 'medium' as const,
  },
  {
    name: 'Failed Payment Transaction',
    description: 'Detect failed payment transactions',
    dsl: 'span.name CONTAINS "payment" AND span.status.code == 2',
    severity: 'critical' as const,
  },
  {
    name: 'PII Access Without Audit',
    description: 'Detect PII access without audit logging',
    dsl: 'span.attributes["pii.accessed"] == true AND NOT span.attributes["audit.logged"]',
    severity: 'critical' as const,
  },
  {
    name: 'High Memory Usage',
    description: 'Detect spans with memory usage over 1GB',
    dsl: 'span.attributes["process.runtime.memory.used"] > 1000000000',
    severity: 'high' as const,
  },
];

export function RuleModal({ isOpen, onClose, onSave, rule }: RuleModalProps) {
  const [formData, setFormData] = useState<Omit<Rule, 'id'>>({
    name: '',
    description: '',
    dsl: '',
    enabled: true,
    severity: 'medium',
  });

  const [isValid, setIsValid] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(!rule);  // Show templates only in create mode

  useEffect(() => {
    if (rule) {
      setFormData({
        name: rule.name,
        description: rule.description,
        dsl: rule.dsl,
        enabled: rule.enabled,
        severity: rule.severity,
      });
      setShowTemplates(false);
    } else {
      setFormData({
        name: '',
        description: '',
        dsl: '',
        enabled: true,
        severity: 'medium',
      });
      setShowTemplates(true);
    }
  }, [rule]);

  const handleSave = async () => {
    if (!isValid || !formData.name.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Failed to save rule:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTemplateSelect = (template: typeof RULE_TEMPLATES[0]) => {
    setFormData({
      ...formData,
      name: template.name,
      description: template.description,
      dsl: template.dsl,
      severity: template.severity,
    });
    setShowTemplates(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {rule ? 'Edit Rule' : 'Create New Rule'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-6">
          {/* Templates */}
          {showTemplates && !rule && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700">Start from template</h3>
                <button
                  onClick={() => setShowTemplates(false)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Start from scratch
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {RULE_TEMPLATES.map((template, index) => (
                  <button
                    key={index}
                    onClick={() => handleTemplateSelect(template)}
                    className="text-left p-3 border border-gray-300 rounded-md hover:border-blue-500 hover:bg-blue-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm text-gray-900">{template.name}</h4>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          template.severity === 'critical'
                            ? 'bg-red-100 text-red-800'
                            : template.severity === 'high'
                            ? 'bg-orange-100 text-orange-800'
                            : template.severity === 'medium'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {template.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-600">{template.description}</p>
                  </button>
                ))}
              </div>
              <div className="mt-3 text-center">
                <button
                  onClick={() => setShowTemplates(false)}
                  className="text-sm text-gray-600 hover:text-gray-700"
                >
                  Or start from scratch →
                </button>
              </div>
            </div>
          )}

          {/* Form */}
          {(!showTemplates || rule) && (
            <>
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rule Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Slow Database Query Detection"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what this rule detects..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* DSL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  BeTraceDSL Pattern <span className="text-red-500">*</span>
                </label>
                <MonacoEditor
                  value={formData.dsl}
                  onChange={(value) => setFormData({ ...formData, dsl: value })}
                  onValidate={(valid, errors) => {
                    setIsValid(valid);
                    setValidationErrors(errors);
                  }}
                  height="200px"
                />
                {validationErrors.length > 0 && (
                  <div className="mt-2 text-sm text-red-600">
                    {validationErrors.map((error, index) => (
                      <div key={index}>• {error}</div>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  Use Ctrl+Space for autocomplete. Example:{' '}
                  <code className="bg-gray-100 px-1 py-0.5 rounded">
                    span.duration {'>'} 1000 AND span.attributes["db.system"] EXISTS
                  </code>
                </p>
              </div>

              {/* Severity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                <div className="flex gap-3">
                  {(['low', 'medium', 'high', 'critical'] as const).map((sev) => (
                    <button
                      key={sev}
                      onClick={() => setFormData({ ...formData, severity: sev })}
                      className={`flex-1 px-4 py-2 border rounded-md text-sm font-medium transition-colors ${
                        formData.severity === sev
                          ? sev === 'critical'
                            ? 'bg-red-600 text-white border-red-600'
                            : sev === 'high'
                            ? 'bg-orange-600 text-white border-orange-600'
                            : sev === 'medium'
                            ? 'bg-yellow-600 text-white border-yellow-600'
                            : 'bg-green-600 text-white border-green-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {sev.charAt(0).toUpperCase() + sev.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Enabled */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="enabled" className="ml-2 text-sm text-gray-700">
                  Enable this rule immediately
                </label>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {(!showTemplates || rule) && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isValid || !formData.name.trim() || isSaving}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : rule ? 'Update Rule' : 'Create Rule'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
