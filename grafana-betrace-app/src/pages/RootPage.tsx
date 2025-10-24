import React, { useState, useEffect } from 'react';
import { AppRootProps } from '@grafana/data';
import { TabsBar, Tab, TabContent } from '@grafana/ui';
import { HomePage } from './HomePage';
import { SignalsPage } from './SignalsPage';
import { RulesPage } from './RulesPage';

type TabView = 'home' | 'signals' | 'rules';

/**
 * RootPage - Main entry point for BeTrace plugin
 *
 * Uses internal tabs with URL sync to maintain navigation state.
 * URL format: /a/betrace-app?tab=<home|signals|rules>
 *
 * Provides:
 * - Home - BeTrace metrics dashboard
 * - Signals - Invariants violations explorer
 * - Rules - Rule management (with sub-pages via query params)
 */
export const RootPage: React.FC<AppRootProps> = ({ query }) => {
  // Read initial tab from URL query params
  const getInitialTab = (): TabView => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab === 'signals' || tab === 'rules') {
      return tab;
    }
    return 'home';
  };

  const [activeTab, setActiveTab] = useState<TabView>(getInitialTab());

  // Update URL when tab changes
  const handleTabChange = (tab: TabView) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.pushState({}, '', url.toString());
  };

  // Listen for browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getInitialTab());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div>
      <TabsBar>
        <Tab
          label="Home"
          active={activeTab === 'home'}
          onChangeTab={() => handleTabChange('home')}
        />
        <Tab
          label="Signals"
          active={activeTab === 'signals'}
          onChangeTab={() => handleTabChange('signals')}
        />
        <Tab
          label="Rules"
          active={activeTab === 'rules'}
          onChangeTab={() => handleTabChange('rules')}
        />
      </TabsBar>

      <TabContent>
        {activeTab === 'home' && <HomePage />}
        {activeTab === 'signals' && <SignalsPage />}
        {activeTab === 'rules' && <RulesPage />}
      </TabContent>
    </div>
  );
};
