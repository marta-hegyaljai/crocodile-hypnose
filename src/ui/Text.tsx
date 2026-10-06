import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { devMode } from '@/config/env';
import { isPlaceholderText } from '@/copy';
import {
  maxFontSizeMultiplier,
  textToneColor,
  typeScale,
  useTheme,
  type TextTone,
  type TextVariant,
} from '@/theme';

export type { TextTone };

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: TextTone;
  align?: TextStyle['textAlign'];
  /** Explicit colour, overrides `tone`. */
  color?: string;
  /** Expose as a heading to assistive technology. */
  heading?: boolean;
  /**
   * Marks copy that is still a placeholder for MHP's text (dashed underline in dev mode).
   * Auto-detected when `children` is a single string from the copy module.
   */
  placeholder?: boolean;
  ref?: React.Ref<RNText>;
}

/** Typographic text. Uses the type scale and theme colours; always prefer this over RN's Text. */
export function Text({
  variant = 'body',
  tone = 'primary',
  align,
  color,
  heading = false,
  placeholder,
  style,
  children,
  ref,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const { colors } = theme;
  const isPlaceholder = placeholder ?? isPlaceholderText(children);
  const showMark = devMode && isPlaceholder;

  return (
    <RNText
      ref={ref}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      accessibilityRole={heading ? 'header' : undefined}
      {...rest}
      style={[
        typeScale[variant],
        { color: color ?? textToneColor(theme, tone), textAlign: align },
        showMark && {
          textDecorationLine: 'underline',
          textDecorationStyle: 'dashed',
          textDecorationColor: colors.accentDeep,
        },
        style,
      ]}
    >
      {children}
    </RNText>
  );
}
