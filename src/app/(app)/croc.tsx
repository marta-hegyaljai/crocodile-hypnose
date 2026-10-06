import React from 'react';

import { t } from '@/copy';
import { TabPlaceholder } from '@/features/home/TabPlaceholder';

/** The croc's habitat (step 7). */
export default function CrocTab() {
  return (
    <TabPlaceholder
      title={t('tabs.croc')}
      message={t('tabsPlaceholder.croc')}
      expression="happy"
      testID="croc-screen"
    />
  );
}
