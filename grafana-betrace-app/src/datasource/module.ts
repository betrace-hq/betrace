import { DataSourcePlugin } from '@grafana/data';
import { BeTraceDataSource } from './DataSource';
import { ConfigEditor } from './ConfigEditor';
import { QueryEditor } from './QueryEditor';
import { BeTraceQuery, BeTraceDataSourceOptions } from './types';

export const plugin = new DataSourcePlugin<BeTraceDataSource, BeTraceQuery, BeTraceDataSourceOptions>(
  BeTraceDataSource
)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
