import React from 'react';

import { t } from '@/copy';
import { TabPlaceholder } from '@/features/home/TabPlaceholder';

/** The mini-games (step 6). */
export default function GamesTab() {
  return (
    <TabPlaceholder
      title={t('tabs.games')}
      message={t('tabsPlaceholder.games')}
      expression="excited"
      testID="games-screen"
    />
  );
}
