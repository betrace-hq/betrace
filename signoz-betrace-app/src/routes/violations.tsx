import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

export const Route = createFileRoute('/violations')({
  component: ViolationsPage,
});

interface Violation {
  id: string;
  ruleId: string;
  ruleName: string;
  traceId: string;
  spanId: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metadata: Record<string, any>;
}

function ViolationsPage() {
  const backendUrl = localStorage.getItem('betrace_backend_url') || 'http://localhost:12011';
  const signozUrl = localStorage.getItem('signoz_url') || 'http://localhost:3301';
  const [timeRange, setTimeRange] = useState('24h');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  const { data: violations, isLoading } = useQuery({
    queryKey: ['violations', timeRange, severityFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        timeRange,
        ...(severityFilter !== 'all' && { severity: severityFilter }),
      });
      const response = await fetch(`${backendUrl}/api/violations?${params}`);
      if (!response.ok) throw new Error('Failed to fetch violations');
      return response.json() as Promise<Violation[]>;
    },
    refetchInterval: 10000,
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const openInSigNoz = (traceId: string) => {
    window.open(`${signozUrl}/trace/${traceId}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Violations</h2>
        <p className="mt-2 text-sm text-gray-600">
          Track rule violations detected in OpenTelemetry traces
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex items-center justify-between space-x-4">
          <div className="flex items-center space-x-4">
            <div>
              <label htmlFor="timeRange" className="block text-sm font-medium text-gray-700">
                Time Range
              </label>
              <select
                id="timeRange"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="1h">Last 1 hour</option>
                <option value="6h">Last 6 hours</option>
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
            </div>
            <div>
              <label htmlFor="severity" className="block text-sm font-medium text-gray-700">
                Severity
              </label>
              <select
                id="severity"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="all">All</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            Total: <span className="font-semibold text-gray-900">{violations?.length ?? 0}</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {violations?.map((violation) => (
              <li key={violation.id}>
                <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(violation.severity)}`}>
                          {violation.severity}
                        </span>
                        <h3 className="text-sm font-medium text-gray-900">{violation.ruleName}</h3>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{violation.message}</p>
                      <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                        <span className="font-mono">Trace: {violation.traceId.substring(0, 16)}...</span>
                        <span className="font-mono">Span: {violation.spanId.substring(0, 16)}...</span>
                        <span>{new Date(violation.timestamp).toLocaleString()}</span>
                      </div>
                      {violation.metadata && Object.keys(violation.metadata).length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                            Show metadata
                          </summary>
                          <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                            {JSON.stringify(violation.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                    <div>
                      <button
                        onClick={() => openInSigNoz(violation.traceId)}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg className="-ml-0.5 mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        View in SigNoz
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {(!violations || violations.length === 0) && (
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
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No violations</h3>
              <p className="mt-1 text-sm text-gray-500">
                No rule violations detected in the selected time range.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Violations in SigNoz</h3>
            <p className="mt-2 text-sm text-blue-700">
              All violations are exported to SigNoz as OTLP spans. Click "View in SigNoz" to see the full trace context and set up alerts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
