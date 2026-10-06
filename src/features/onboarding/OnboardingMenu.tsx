import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { t } from '@/copy';
import { useSubmit } from '@/features/auth/useSubmit';
import { useAuth } from '@/services/auth';
import { useProfile } from '@/services/profile';
import { radius, space, useTheme } from '@/theme';
import { Button, IconButton, Reveal, Text } from '@/ui';

/**
 * A small account menu for the onboarding screens: who is signed in, and a way out (sign out,
 * progress kept in the account) for someone on the wrong account or a shared device.
 */
export function OnboardingMenu({ disabled = false }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const { colors, shadow } = useTheme();
  const email = useAuth((s) => s.user?.email ?? '');
  const signOut = useAuth((s) => s.signOut);
  const flush = useProfile((s) => s.flush);
  const signingOut = useSubmit(async () => {
    // Pending answers go to the server first, while the token is still valid.
    await flush();
    await signOut();
  });

  return (
    <View style={styles.root} pointerEvents="box-none">
      <IconButton
        icon="profile"
        variant="filled"
        accessibilityLabel={t('onboarding.menu.open')}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        disabled={disabled}
        testID="onboarding-menu"
      />
      {open ? (
        <Reveal offset={-8} style={styles.panelWrap} testID="onboarding-menu-panel">
          <View
            style={[
              styles.panel,
              shadow.raised,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text variant="caption" tone="secondary" numberOfLines={2}>
              {t('onboarding.menu.signedInAs', { email })}
            </Text>
            <Text variant="caption" tone="secondary">
              {t('onboarding.menu.note')}
            </Text>
            <Button
              label={t('onboarding.menu.signOut')}
              variant="secondary"
              size="sm"
              fullWidth
              loading={signingOut.pending}
              onPress={() => void signingOut.run()}
              testID="onboarding-sign-out"
            />
            <Button
              label={t('onboarding.menu.cancel')}
              variant="ghost"
              size="sm"
              fullWidth
              disabled={signingOut.pending}
              onPress={() => setOpen(false)}
              testID="onboarding-menu-cancel"
            />
          </View>
        </Reveal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative', zIndex: 20 },
  panelWrap: { position: 'absolute', top: 52, right: 0, width: 260 },
  panel: { borderRadius: radius.md, borderWidth: 1, padding: space.md, gap: space.sm },
});
