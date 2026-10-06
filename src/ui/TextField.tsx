import React, { useId, useState } from 'react';
import {
  Platform,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { t } from '@/copy';
import { fontFamily, radius, space, tapTarget, useTheme, withAlpha } from '@/theme';

import { IconButton } from './IconButton';
import { Icon } from './icons/Icon';
import { Reveal } from './Reveal';
import { Text } from './Text';

export interface TextFieldProps extends Omit<
  TextInputProps,
  'style' | 'secureTextEntry' | 'placeholder' | 'editable'
> {
  label: string;
  /** Inline error under the field. Also marks the field invalid for assistive tech. */
  error?: string | null;
  /** Help text under the field (hidden while an error shows). */
  hint?: string;
  /** Password field: hides the text and adds a show / hide toggle. */
  secure?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  ref?: React.Ref<TextInput>;
}

const FIELD_HEIGHT = 52;
/** Width of the soft ring drawn around a focused or invalid field. */
const HALO = 4;

/**
 * Labelled text input on a pebble-round field. Focus draws the focus colour around the field,
 * errors switch the outline to the error colour and show a message with a drop icon below.
 */
export function TextField({
  label,
  error,
  hint,
  secure = false,
  onVisibilityChange,
  disabled = false,
  containerStyle,
  onFocus,
  onBlur,
  testID,
  ref,
  ...rest
}: TextFieldProps) {
  const theme = useTheme();
  const { colors } = theme;
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const messageId = `field-msg-${id}`;
  const message = error || hint;

  const borderColor = error ? colors.danger : focused ? colors.focusRing : colors.inputBorder;
  // A soft halo outside the outline: the focus colour while editing, the error colour when invalid.
  const halo = focused
    ? withAlpha(colors.focusRing, 0.18)
    : error
      ? withAlpha(colors.danger, 0.12)
      : null;

  const toggle = () => {
    const next = !visible;
    setVisible(next);
    onVisibilityChange?.(next);
  };

  return (
    <View style={[styles.root, containerStyle]}>
      <Text variant="label" tone="secondary" nativeID={`field-label-${id}`}>
        {label}
      </Text>
      <View
        style={[
          styles.field,
          {
            borderColor,
            borderWidth: focused || error ? 2.5 : 2,
            backgroundColor: disabled
              ? colors.surfaceSunken
              : focused
                ? colors.surface
                : colors.surfaceRaised,
          },
        ]}
      >
        {halo ? <View pointerEvents="none" style={[styles.halo, { borderColor: halo }]} /> : null}
        <TextInput
          {...rest}
          ref={ref}
          testID={testID}
          editable={!disabled}
          secureTextEntry={secure && !visible}
          accessibilityLabel={label}
          aria-invalid={Boolean(error)}
          aria-describedby={message ? messageId : undefined}
          // Native screen readers have no describedby: read the message as the hint.
          accessibilityHint={Platform.OS === 'web' ? undefined : message || undefined}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.focusRing}
          cursorColor={colors.textPrimary}
          maxFontSizeMultiplier={1.6}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            { color: disabled ? colors.textMuted : colors.textPrimary },
            secure && styles.inputWithToggle,
            Platform.OS === 'web' && styles.webInput,
          ]}
        />
        {secure && (
          <IconButton
            icon={visible ? 'eyeOff' : 'eye'}
            accessibilityLabel={
              visible ? t('auth.fields.hidePassword') : t('auth.fields.showPassword')
            }
            onPress={toggle}
            disabled={disabled}
            testID={testID ? `${testID}-toggle` : undefined}
            style={styles.toggle}
          />
        )}
      </View>
      {message ? (
        // Keyed on the kind of message, so an error replacing the hint is revealed too.
        <Reveal key={error ? 'error' : 'hint'} offset={4}>
          <View style={styles.message} nativeID={messageId} accessibilityLiveRegion="polite">
            {error ? <Icon name="alert" size={16} color={colors.textDanger} /> : null}
            <Text
              variant="caption"
              tone={error ? 'danger' : 'muted'}
              style={styles.messageText}
              testID={testID ? `${testID}-${error ? 'error' : 'hint'}` : undefined}
            >
              {message}
            </Text>
          </View>
        </Reveal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.xs + 2, alignSelf: 'stretch' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: FIELD_HEIGHT,
    borderRadius: radius.md,
  },
  halo: {
    position: 'absolute',
    top: -HALO - 2.5,
    left: -HALO - 2.5,
    right: -HALO - 2.5,
    bottom: -HALO - 2.5,
    borderWidth: HALO,
    borderRadius: radius.md + HALO + 2,
  },
  input: {
    flex: 1,
    minHeight: Math.max(FIELD_HEIGHT - 4, tapTarget),
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    fontFamily: fontFamily.body,
    // 16px keeps iOS Safari from zooming in on focus.
    fontSize: 16,
    lineHeight: 22,
  },
  inputWithToggle: { paddingRight: space.xs },
  webInput: { outlineWidth: 0 } as object,
  toggle: { marginRight: space.xxs },
  message: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  messageText: { flexShrink: 1 },
});
