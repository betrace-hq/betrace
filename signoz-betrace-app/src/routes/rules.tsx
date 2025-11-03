import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { RuleModal, Rule } from '../components/RuleModal';

export const Route = createFileRoute('/rules')({
  component: RulesPage,
});

interface RuleWithTimestamps extends Rule {
  createdAt: string;
  updatedAt: string;
}

function RulesPage() {
  const queryClient = useQueryClient();
  const backendUrl = localStorage.getItem('betrace_backend_url') || 'http://localhost:12011';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleWithTimestamps | undefined>(undefined);

  const { data: rules, isLoading } = useQuery({
    queryKey: ['rules'],
    queryFn: async () => {
      const response = await fetch(`${backendUrl}/api/rules`);
      if (!response.ok) throw new Error('Failed to fetch rules');
      return response.json() as Promise<RuleWithTimestamps[]>;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (rule: Omit<Rule, 'id'>) => {
      const response = await fetch(`${backendUrl}/api/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule),
      });
      if (!response.ok) throw new Error('Failed to create rule');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, rule }: { id: string; rule: Omit<Rule, 'id'> }) => {
      const response = await fetch(`${backendUrl}/api/rules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule),
      });
      if (!response.ok) throw new Error('Failed to update rule');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const response = await fetch(`${backendUrl}/api/rules/${ruleId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete rule');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ ruleId, enabled }: { ruleId: string; enabled: boolean }) => {
      const response = await fetch(`${backendUrl}/api/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) throw new Error('Failed to toggle rule');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });

  const handleCreateRule = () => {
    setEditingRule(undefined);
    setIsModalOpen(true);
  };

  const handleEditRule = (rule: RuleWithTimestamps) => {
    setEditingRule(rule);
    setIsModalOpen(true);
  };

  const handleSaveRule = async (rule: Omit<Rule, 'id'>) => {
    if (editingRule) {
      await updateMutation.mutateAsync({ id: editingRule.id!, rule });
    } else {
      await createMutation.mutateAsync(rule);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Rules</h2>
          <p className="mt-2 text-sm text-gray-600">
            Manage behavioral pattern matching rules using BeTraceDSL
          </p>
        </div>
        <button
          onClick={handleCreateRule}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Rule
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {rules?.map((rule) => (
              <li key={rule.id}>
                <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-sm font-medium text-gray-900 truncate">{rule.name}</h3>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            rule.severity === 'critical'
                              ? 'bg-red-100 text-red-800'
                              : rule.severity === 'high'
                              ? 'bg-orange-100 text-orange-800'
                              : rule.severity === 'medium'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {rule.severity}
                        </span>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            rule.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {rule.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">{rule.description}</p>
                      <p className="mt-1 text-xs text-gray-400 font-mono bg-gray-50 p-2 rounded">{rule.dsl}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => toggleMutation.mutate({ ruleId: rule.id!, enabled: !rule.enabled })}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        {rule.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => handleEditRule(rule)}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete rule "${rule.name}"?`)) {
                            deleteMutation.mutate(rule.id!);
                          }
                        }}
                        className="inline-flex items-center px-3 py-1.5 border border-red-300 shadow-sm text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {(!rules || rules.length === 0) && (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No rules</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating a new rule.</p>
              <div className="mt-6">
                <button
                  onClick={handleCreateRule}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Rule
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Monaco Editor Feature Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Monaco Editor Integration Active</h3>
            <p className="mt-2 text-sm text-blue-700">
              BeTraceDSL rule editor with syntax highlighting, autocomplete, and real-time validation is now available!
              Click "Create Rule" or "Edit" to try it out.
            </p>
            <ul className="mt-2 text-sm text-blue-700 list-disc list-inside">
              <li>Syntax highlighting for BeTraceDSL</li>
              <li>Autocomplete (Ctrl+Space) for attributes and operators</li>
              <li>6 pre-built rule templates</li>
              <li>Real-time DSL validation</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Rule Modal */}
      <RuleModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingRule(undefined);
        }}
        onSave={handleSaveRule}
        rule={editingRule}
      />
    </div>
  );
}
