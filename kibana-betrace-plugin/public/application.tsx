import React from 'react';
import ReactDOM from 'react-dom';
import { AppMountParameters, CoreStart } from '@kbn/core/public';
import { KibanaContextProvider } from '@kbn/kibana-react-plugin/public';
import { Router, Routes, Route } from 'react-router-dom';
import { EuiProvider } from '@elastic/eui';

import { RulesPage } from './pages/RulesPage';
import { ViolationsPage } from './pages/ViolationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { DashboardPage } from './pages/DashboardPage';
import { AppLayout } from './components/AppLayout';

export const renderApp = (core: CoreStart, { element, history }: AppMountParameters) => {
  ReactDOM.render(
    <KibanaContextProvider services={core}>
      <EuiProvider colorMode="light">
        <Router location={history.location} navigator={history}>
          <AppLayout>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/rules" element={<RulesPage />} />
              <Route path="/violations" element={<ViolationsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </AppLayout>
        </Router>
      </EuiProvider>
    </KibanaContextProvider>,
    element
  );

  return () => ReactDOM.unmountComponentAtNode(element);
};
