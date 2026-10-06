import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, space, useTheme, withAlpha } from '@/theme';

import { Button } from './Button';
import { Icon, type IconName } from './icons/Icon';
import { Reveal } from './Reveal';
import { Text } from './Text';

export type NoticeTone = 'error' | 'info' | 'success';

export interface NoticeProps {
  tone?: NoticeTone;
  message: string;
  title?: string;
  /** One follow-up action, e.g. Retry. */
  action?: { label: string; onPress: () => void; testID?: string };
  placeholder?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const icons: Record<NoticeTone, IconName> = { error: 'alert', info: 'info', success: 'check' };

/** A short message in a soft pebble: form errors, connection problems, confirmations. */
export function Notice({
  tone = 'info',
  message,
  title,
  action,
  placeholder,
  testID,
  style,
}: NoticeProps) {
  const { colors, atmosphere } = useTheme();
  const night = atmosphere === 'night';
  const look: Record<NoticeTone, { bg: string; edge: string; icon: string }> = {
    error: { bg: colors.dangerSoft, edge: colors.danger, icon: colors.textDanger },
    info: {
      bg: colors.surfaceRaised,
      edge: night ? colors.waterLight : colors.water,
      icon: colors.textWater,
    },
    success: {
      bg: night ? colors.surfaceRaised : colors.primarySoft,
      edge: colors.primary,
      icon: night ? colors.waterLight : colors.primaryDeep,
    },
  };
  const c = look[tone];

  return (
    // Notices appear in answer to something the user did: they fade and lift in rather than pop.
    <Reveal style={style}>
      <View
        testID={testID}
        accessibilityRole={tone === 'error' ? 'alert' : undefined}
        accessibilityLiveRegion={tone === 'error' ? 'assertive' : 'polite'}
        style={[
          styles.root,
          { backgroundColor: c.bg, borderLeftColor: c.edge, borderColor: withAlpha(c.edge, 0.18) },
        ]}
      >
        <View style={styles.row}>
          <View
            style={[styles.iconWell, { backgroundColor: withAlpha(c.edge, night ? 0.22 : 0.12) }]}
          >
            <Icon name={icons[tone]} size={20} color={c.icon} />
          </View>
          <View style={styles.text}>
            {title ? (
              <Text variant="bodyStrong" placeholder={placeholder}>
                {title}
              </Text>
            ) : null}
            <Text
              variant="body"
              placeholder={placeholder}
              testID={testID ? `${testID}-message` : undefined}
            >
              {message}
            </Text>
          </View>
        </View>
        {action ? (
          <Button
            label={action.label}
            variant="secondary"
            size="sm"
            onPress={action.onPress}
            testID={action.testID}
            style={styles.action}
          />
        ) : null}
      </View>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderLeftWidth: 5,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    gap: space.md,
    alignSelf: 'stretch',
  },
  row: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  iconWell: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    // Centred on the first line of body text (24px line height).
    marginTop: -4,
  },
  text: { flex: 1, gap: space.xxs },
  action: { alignSelf: 'flex-end' },
});
