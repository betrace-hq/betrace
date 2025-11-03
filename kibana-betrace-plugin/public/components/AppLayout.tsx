import React from 'react';
import {
  EuiPage,
  EuiPageBody,
  EuiPageSidebar,
  EuiPageHeader,
  EuiSideNav,
} from '@elastic/eui';
import { useLocation, useNavigate } from 'react-router-dom';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const sideNav = [
    {
      name: 'BeTrace',
      id: 'betrace',
      items: [
        {
          name: 'Dashboard',
          id: 'dashboard',
          onClick: () => navigate('/'),
          isSelected: location.pathname === '/',
        },
        {
          name: 'Rules',
          id: 'rules',
          onClick: () => navigate('/rules'),
          isSelected: location.pathname === '/rules',
        },
        {
          name: 'Violations',
          id: 'violations',
          onClick: () => navigate('/violations'),
          isSelected: location.pathname === '/violations',
        },
        {
          name: 'Settings',
          id: 'settings',
          onClick: () => navigate('/settings'),
          isSelected: location.pathname === '/settings',
        },
      ],
    },
  ];

  return (
    <EuiPage>
      <EuiPageSidebar>
        <EuiSideNav items={sideNav} />
      </EuiPageSidebar>
      <EuiPageBody>
        <EuiPageHeader
          pageTitle="BeTrace"
          description="Behavioral pattern matching on OpenTelemetry traces"
        />
        {children}
      </EuiPageBody>
    </EuiPage>
  );
};
