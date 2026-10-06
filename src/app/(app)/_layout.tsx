import { Tabs } from 'expo-router/js-tabs';
import React from 'react';

import { t } from '@/copy';
import { TabBar, type TabItem } from '@/ui';

type TabKey = 'home' | 'croc' | 'games' | 'profile';

const ITEMS: readonly TabItem<TabKey>[] = [
  { key: 'home', label: t('tabs.home'), icon: 'home' },
  { key: 'croc', label: t('tabs.croc'), icon: 'croc' },
  { key: 'games', label: t('tabs.games'), icon: 'games' },
  { key: 'profile', label: t('tabs.profile'), icon: 'profile' },
];

/** The signed-in app: four tabs on the step 1 tab bar. */
export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => (
        <TabBar
          items={ITEMS}
          activeKey={state.routes[state.index]?.name as TabKey}
          onChange={(key) => navigation.navigate(key)}
          testID="tab"
        />
      )}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="croc" />
      <Tabs.Screen name="games" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
