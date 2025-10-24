import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  FieldType,
  MutableDataFrame,
} from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { BeTraceQuery, BeTraceDataSourceOptions, ViolationData, StatsData } from './types';

export class BeTraceDataSource extends DataSourceApi<BeTraceQuery, BeTraceDataSourceOptions> {
  backendUrl: string;
  timeout: number;

  constructor(instanceSettings: DataSourceInstanceSettings<BeTraceDataSourceOptions>) {
    super(instanceSettings);
    this.backendUrl = instanceSettings.jsonData.backendUrl || 'http://localhost:12011';
    this.timeout = instanceSettings.jsonData.timeout || 30000;
  }

  /**
   * Main query method - transforms BeTrace queries into Grafana dataframes
   */
  async query(options: DataQueryRequest<BeTraceQuery>): Promise<DataQueryResponse> {
    const { range } = options;
    const from = range!.from.valueOf();
    const to = range!.to.valueOf();

    const promises = options.targets.map(async (target) => {
      if (target.hide) {
        return null;
      }

      switch (target.queryType) {
        case 'violations':
          return this.queryViolations(target, from, to);
        case 'stats':
          return this.queryStats(target, from, to);
        case 'traces':
          return this.queryTraces(target, from, to);
        default:
          throw new Error(`Unknown query type: ${target.queryType}`);
      }
    });

    const data = await Promise.all(promises);
    return { data: data.filter((d) => d !== null) as any[] };
  }

  /**
   * Query violations from BeTrace backend
   */
  private async queryViolations(query: BeTraceQuery, from: number, to: number) {
    const params = new URLSearchParams({
      from: from.toString(),
      to: to.toString(),
    });

    if (query.severity && query.severity !== 'all') {
      params.append('severity', query.severity);
    }
    if (query.serviceName) {
      params.append('service', query.serviceName);
    }
    if (query.ruleId) {
      params.append('rule', query.ruleId);
    }
    if (query.limit) {
      params.append('limit', query.limit.toString());
    }

    const response = await getBackendSrv().fetch({
      url: `${this.backendUrl}/api/violations?${params}`,
      method: 'GET',
    }).toPromise();

    const violations: ViolationData[] = response.data;

    // Transform to Grafana dataframe
    const frame = new MutableDataFrame({
      refId: query.refId,
      fields: [
        { name: 'Time', type: FieldType.time },
        { name: 'Trace ID', type: FieldType.string },
        { name: 'Span ID', type: FieldType.string },
        { name: 'Rule Name', type: FieldType.string },
        { name: 'Severity', type: FieldType.string },
        { name: 'Service', type: FieldType.string },
        { name: 'Span Name', type: FieldType.string },
        { name: 'Message', type: FieldType.string },
      ],
    });

    violations.forEach((v) => {
      frame.add({
        Time: v.timestamp,
        'Trace ID': v.traceId,
        'Span ID': v.spanId,
        'Rule Name': v.ruleName,
        Severity: v.severity,
        Service: v.serviceName,
        'Span Name': v.spanName,
        Message: v.message,
      });
    });

    return frame;
  }

  /**
   * Query statistics from BeTrace backend
   */
  private async queryStats(query: BeTraceQuery, from: number, to: number) {
    const params = new URLSearchParams({
      from: from.toString(),
      to: to.toString(),
    });

    if (query.statsType) {
      params.append('type', query.statsType);
    }
    if (query.groupBy) {
      params.append('groupBy', query.groupBy);
    }
    if (query.interval) {
      params.append('interval', query.interval);
    }

    const response = await getBackendSrv().fetch({
      url: `${this.backendUrl}/api/violations/stats?${params}`,
      method: 'GET',
    }).toPromise();

    const stats: StatsData = response.data;

    // Transform to Grafana dataframe
    const frame = new MutableDataFrame({
      refId: query.refId,
      fields: [
        { name: 'Metric', type: FieldType.string },
        { name: 'Value', type: FieldType.number },
      ],
    });

    frame.add({ Metric: 'Total', Value: stats.total });
    frame.add({ Metric: 'Critical', Value: stats.critical });
    frame.add({ Metric: 'High', Value: stats.high });
    frame.add({ Metric: 'Medium', Value: stats.medium });
    frame.add({ Metric: 'Low', Value: stats.low });
    frame.add({ Metric: 'Last 24h', Value: stats.last24h });
    frame.add({ Metric: 'Last Hour', Value: stats.lastHour });
    frame.add({ Metric: 'Affected Services', Value: stats.affectedServices });
    frame.add({ Metric: 'Affected Traces', Value: stats.affectedTraces });

    return frame;
  }

  /**
   * Query traces from BeTrace backend
   */
  private async queryTraces(query: BeTraceQuery, from: number, to: number) {
    if (!query.traceId) {
      throw new Error('Trace ID is required for trace queries');
    }

    const response = await getBackendSrv().fetch({
      url: `${this.backendUrl}/api/traces/${query.traceId}`,
      method: 'GET',
    }).toPromise();

    const trace = response.data;

    // Transform to Grafana dataframe (simplified - just span info)
    const frame = new MutableDataFrame({
      refId: query.refId,
      fields: [
        { name: 'Time', type: FieldType.time },
        { name: 'Span ID', type: FieldType.string },
        { name: 'Span Name', type: FieldType.string },
        { name: 'Duration (ns)', type: FieldType.number },
        { name: 'Status', type: FieldType.string },
      ],
    });

    trace.spans.forEach((span: any) => {
      frame.add({
        Time: span.startTime / 1000000, // Convert ns to ms
        'Span ID': span.spanId,
        'Span Name': span.name,
        'Duration (ns)': span.duration,
        Status: span.status.code,
      });
    });

    return frame;
  }

  /**
   * Test datasource connection
   */
  async testDatasource() {
    try {
      const response = await getBackendSrv().fetch({
        url: `${this.backendUrl}/health`,
        method: 'GET',
      }).toPromise();

      if (response.status === 200) {
        return {
          status: 'success',
          message: 'Successfully connected to BeTrace backend',
        };
      }

      return {
        status: 'error',
        message: `Unexpected response: ${response.status}`,
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to connect: ${error}`,
      };
    }
  }
}
