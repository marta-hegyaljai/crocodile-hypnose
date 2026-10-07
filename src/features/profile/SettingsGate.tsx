import React from 'react';

import { t } from '@/copy';
import { useProfile } from '@/services/profile';
import { Notice } from '@/ui';

/**
 * Shows its settings controls only once the user's own settings are in (a device copy or the
 * server's). Until then the defaults stand in, and a change made on them would look like the
 * user's choice; a retry is offered while the server cannot be reached.
 */
export function SettingsGate({ children }: { children: React.ReactNode }) {
  const known = useProfile((s) => s.settingsKnown);
  const failed = useProfile((s) => !s.settingsKnown && !!s.syncError);
  const flush = useProfile((s) => s.flush);
  if (known) return <>{children}</>;
  return (
    <Notice
      tone="info"
      message={t('profile.settingsLoading')}
      action={
        failed
          ? { label: t('common.retry'), onPress: () => void flush(), testID: 'settings-retry' }
          : undefined
      }
      testID="settings-loading"
    />
  );
}
