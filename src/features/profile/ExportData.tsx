import React, { useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, View, useWindowDimensions } from 'react-native';

import { t } from '@/copy';
import { describeAuthError } from '@/features/auth/describeError';
import { useSubmit } from '@/features/auth/useSubmit';
import { useProfile } from '@/services/profile';
import { radius, space, useTheme } from '@/theme';
import { Button, Notice, Text } from '@/ui';

async function copyText(text: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  try {
    await Share.share({ message: text });
    return true;
  } catch {
    return false;
  }
}

/**
 * Export my data: the server's copy as JSON, shown in a block to select and copy (downloads are
 * blocked in some web views), with a Copy button (Share on a phone).
 */
export function ExportData() {
  const exportData = useProfile((s) => s.exportData);
  const { colors } = useTheme();
  const [json, setJson] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // The block takes most of the screen, so the JSON reads as a document, not a peephole.
  const { height } = useWindowDimensions();
  const blockHeight = Math.max(320, Math.round(height * 0.6));

  const exporting = useSubmit(async () => {
    setError(null);
    setCopied(false);
    try {
      setJson(await exportData());
    } catch (err) {
      setJson(null);
      const { key, params } = describeAuthError(err);
      setError(`${t('privacy.exportFailed')} ${t(key, params)}`);
    }
  });

  return (
    <View style={styles.stack}>
      <Text variant="body" tone="secondary">
        {t('privacy.exportBody')}
      </Text>
      <Button
        label={exporting.pending ? t('privacy.exportWorking') : t('privacy.exportAction')}
        variant="secondary"
        size="lg"
        fullWidth
        loading={exporting.pending}
        onPress={() => void exporting.run()}
        testID="export-data"
      />
      {error ? <Notice tone="error" message={error} testID="export-error" /> : null}
      {json ? (
        <View style={styles.stack} testID="export-result">
          <Notice tone="success" message={t('privacy.exportReady')} />
          <View
            style={[
              styles.block,
              { backgroundColor: colors.surfaceSunken, borderColor: colors.border },
            ]}
          >
            <ScrollView
              nestedScrollEnabled
              style={{ maxHeight: blockHeight }}
              accessibilityLabel={t('privacy.exportLabel')}
            >
              <Text variant="caption" selectable style={styles.mono} testID="export-json">
                {json}
              </Text>
            </ScrollView>
          </View>
          <Button
            label={
              copied
                ? t('privacy.exportCopied')
                : Platform.OS === 'web'
                  ? t('privacy.exportCopy')
                  : t('privacy.exportShare')
            }
            variant="secondary"
            fullWidth
            onPress={() => void copyText(json).then((ok) => setCopied(ok))}
            testID="export-copy"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  block: { borderRadius: radius.md, borderWidth: 1, padding: space.md },
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
});
