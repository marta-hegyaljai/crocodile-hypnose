import { Link, router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { devMode } from '@/config/env';
import { useTapShield } from '@/features/layout/TapShield';
import { t } from '@/copy';
import { Lagoon, type CrocExpression } from '@/illustration';
import { space } from '@/theme';
import { Button, Screen, Text } from '@/ui';

/**
 * Landing screen for signed-out users: the croc peeking from the river, the app name and
 * "Get started", which leads into the welcome / account flow. Signed-in users land on home.
 */
export default function IndexScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [expression, setExpression] = useState<CrocExpression>('calm');
  const shield = useTapShield();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // The croc perks up as you head into the welcome / account flow.
  const onPress = useCallback(() => {
    setExpression('excited');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setExpression('happy'), 1400);
    // Welcome's buttons sit where Get started was: a double tap must not open Sign in.
    shield();
    router.push('/welcome');
  }, [shield]);

  // Portrait phones and tablets: title on top, croc centred, CTA on the near bank.
  // Landscape / desktop: title top-left, inset past the leaf cluster so it always sits on the light sky;
  // croc on the right, so they never collide.
  const landscape = width > height;
  const leafSize = landscape
    ? Math.min(Math.round(width * 0.2), Math.round(height * 0.3))
    : Math.min(Math.round(width * 0.32), Math.round(height * 0.3));
  // The top-left foliage reaches about 0.88 of its box to the right; nothing of it lies beyond that.
  const leafInset = landscape ? Math.round(leafSize * 0.9) : 0;
  const titleTop = insets.top + (landscape ? space.xl : space.xxxl + space.xl);
  const crocWidth = landscape
    ? Math.min(Math.round(width * 0.46), 480)
    : Math.min(Math.round(width * 0.86), 520);
  // The near bank starts above the CTA block (button, link, gaps, bottom inset), never under it.
  const footerReserve = insets.bottom + 170;
  const bankTop = Math.min(0.8, Math.max(0.5, (height - footerReserve) / height));

  return (
    <Screen
      scroll={false}
      padded={false}
      edges={[]}
      testID="index-screen"
      background={
        <Lagoon
          width={width}
          height={height}
          stage="juvenile"
          expression={expression}
          waterTop={landscape ? 0.44 : 0.45}
          bankTop={bankTop}
          crocX={landscape ? 0.72 : 0.52}
          crocWidth={crocWidth}
          leafSize={leafSize}
          farReeds={!landscape}
        />
      }
    >
      <View
        style={[
          styles.content,
          { paddingTop: titleTop, paddingBottom: insets.bottom + space.xl },
          landscape && styles.contentLandscape,
        ]}
      >
        <View
          style={[
            styles.header,
            landscape && styles.headerLandscape,
            landscape && { marginLeft: leafInset },
          ]}
        >
          <Text variant="display" align={landscape ? 'left' : 'center'} heading testID="app-name">
            {t('app.name')}
          </Text>
          <Text variant="subheading" tone="secondary" align={landscape ? 'left' : 'center'}>
            {t('app.tagline')}
          </Text>
        </View>
        <View style={styles.footer}>
          <Button
            label={t('common.getStarted')}
            size="lg"
            fullWidth
            onPress={onPress}
            testID="primary-cta"
          />
          {devMode && (
            <Link href="/dev/gallery" asChild>
              <Button label={t('dev.gallery')} variant="ghost" size="sm" testID="gallery-link" />
            </Link>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.xl,
  },
  contentLandscape: { alignItems: 'flex-start' },
  header: { gap: space.xs, width: '100%', maxWidth: 560 },
  headerLandscape: { maxWidth: '44%' },
  footer: {
    gap: space.md,
    alignItems: 'center',
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
});
