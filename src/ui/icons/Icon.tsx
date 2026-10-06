import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/theme';

export type IconName =
  | 'home'
  | 'croc'
  | 'games'
  | 'profile'
  | 'play'
  | 'pause'
  | 'lock'
  | 'check'
  | 'close'
  | 'back'
  | 'drop'
  | 'leaf'
  | 'sparkle'
  | 'eye'
  | 'eyeOff'
  | 'info'
  | 'alert'
  | 'mail'
  | 'rewind'
  | 'waves'
  | 'captions';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  /** Stroke width in the 24pt grid. */
  strokeWidth?: number;
  testID?: string;
}

/** Simple rounded line icons on a 24x24 grid, in the river/jungle vocabulary. */
export function Icon({ name, size = 24, color, strokeWidth = 2.2, testID }: IconProps) {
  const { colors } = useTheme();
  const c = color ?? colors.textPrimary;
  const stroke = {
    stroke: c,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" testID={testID} aria-hidden>
      {name === 'home' && (
        <>
          <Path d="M4 11.5 L12 4.5 L20 11.5" {...stroke} />
          <Path d="M6.5 10.5 V19.5 H17.5 V10.5" {...stroke} />
          <Path d="M10 19.5 V14.5 H14 V19.5" {...stroke} />
        </>
      )}
      {name === 'croc' && (
        <>
          {/* Croc head in profile peeking out of the river: eye bump, long snout, waterline. */}
          <Path
            d="M2.5 14.5 C2.5 11.5 3.5 8 7 7.5 C9.5 7.2 10.8 9.6 12.5 10.2 L19 11.3 C21 11.6 22.2 12.8 22.2 14.5 Z"
            fill={c}
          />
          <Path
            d="M3 14.5 H21.8 C21.8 16.6 20.4 17.8 18.6 17.8 H5.5 C4 17.8 3 16.4 3 14.5 Z"
            fill={c}
          />
          <Path
            d="M4.5 14.6 H20.5"
            stroke={colors.background}
            strokeWidth={1}
            strokeLinecap="round"
          />
          <Circle cx="7.4" cy="10.4" r="1.9" fill={colors.background} />
          <Path d="M7.4 9.1 V11.7" stroke={c} strokeWidth={1.1} strokeLinecap="round" />
          <Path
            d="M1.5 20.5 Q 6.5 18.5 11.5 20.5 T 22.5 20.5"
            {...stroke}
            strokeWidth={strokeWidth * 0.8}
          />
        </>
      )}
      {name === 'games' && (
        <>
          <Circle cx="12" cy="12" r="3.2" {...stroke} />
          <Circle cx="12" cy="12" r="7.5" {...stroke} opacity={0.6} />
          <Circle cx="12" cy="12" r="1" fill={c} />
        </>
      )}
      {name === 'profile' && (
        <>
          <Circle cx="12" cy="8.5" r="3.8" {...stroke} />
          <Path d="M4.5 20 C 5 15.5, 8 14, 12 14 C 16 14, 19 15.5, 19.5 20" {...stroke} />
        </>
      )}
      {name === 'play' && <Path d="M8 5.5 L18.5 12 L8 18.5 Z" fill={c} />}
      {name === 'pause' && (
        <>
          <Path d="M8 6 V18" stroke={c} strokeWidth={3.4} strokeLinecap="round" />
          <Path d="M16 6 V18" stroke={c} strokeWidth={3.4} strokeLinecap="round" />
        </>
      )}
      {name === 'lock' && (
        <>
          <Path d="M7 11 V8.5 A5 5 0 0 1 17 8.5 V11" {...stroke} />
          <Path
            d="M6 11 H18 A1.5 1.5 0 0 1 19.5 12.5 V19 A1.5 1.5 0 0 1 18 20.5 H6 A1.5 1.5 0 0 1 4.5 19 V12.5 A1.5 1.5 0 0 1 6 11 Z"
            fill={c}
          />
        </>
      )}
      {name === 'check' && (
        <Path d="M5 12.5 L10 17.5 L19.5 7" {...stroke} strokeWidth={strokeWidth + 0.6} />
      )}
      {name === 'close' && (
        <>
          <Path d="M6.5 6.5 L17.5 17.5" {...stroke} />
          <Path d="M17.5 6.5 L6.5 17.5" {...stroke} />
        </>
      )}
      {name === 'back' && (
        <>
          <Path d="M14.5 5.5 L8 12 L14.5 18.5" {...stroke} />
        </>
      )}
      {name === 'drop' && (
        <Path
          d="M12 3.5 C 12 3.5, 6 10.5, 6 14.2 A6 6 0 0 0 18 14.2 C 18 10.5, 12 3.5, 12 3.5 Z"
          fill={c}
        />
      )}
      {name === 'leaf' && (
        <>
          <Path d="M5 19 C 5 10, 11 5, 20 5 C 20 14, 14 19.5, 5 19 Z" fill={c} />
          <Path
            d="M6 18 C 9.5 13.5, 13 10.5, 17.5 7.5"
            stroke={colors.background}
            strokeWidth={1.6}
            strokeLinecap="round"
            fill="none"
          />
        </>
      )}
      {name === 'sparkle' && (
        <Path
          d="M12 3 C 12.6 8, 14.5 10.4, 20 12 C 14.5 13.6, 12.6 16, 12 21 C 11.4 16, 9.5 13.6, 4 12 C 9.5 10.4, 11.4 8, 12 3 Z"
          fill={c}
        />
      )}
      {(name === 'eye' || name === 'eyeOff') && (
        <>
          {/* Croc eye: almond lid shape with a slit pupil. */}
          <Path
            d="M2.5 12 C 5.5 6.8, 18.5 6.8, 21.5 12 C 18.5 17.2, 5.5 17.2, 2.5 12 Z"
            {...stroke}
          />
          <Path d="M12 9 C 13.2 10.6, 13.2 13.4, 12 15 C 10.8 13.4, 10.8 10.6, 12 9 Z" fill={c} />
          {name === 'eyeOff' && <Path d="M4.5 19.5 L19.5 4.5" {...stroke} />}
        </>
      )}
      {name === 'info' && (
        <>
          <Circle cx="12" cy="12" r="9" {...stroke} />
          <Path d="M12 11 V16.5" {...stroke} />
          <Circle cx="12" cy="7.8" r="1.3" fill={c} />
        </>
      )}
      {name === 'alert' && (
        <>
          {/* A drop, not a warning sign: errors stay gentle. */}
          <Path
            d="M12 3 C 12 3, 5.5 10.5, 5.5 14.5 A6.5 6.5 0 0 0 18.5 14.5 C 18.5 10.5, 12 3, 12 3 Z"
            {...stroke}
          />
          <Path d="M12 9.5 V14" {...stroke} />
          <Circle cx="12" cy="17" r="1.2" fill={c} />
        </>
      )}
      {name === 'mail' && (
        <>
          <Path
            d="M4.5 6 H19.5 A1.5 1.5 0 0 1 21 7.5 V16.5 A1.5 1.5 0 0 1 19.5 18 H4.5 A1.5 1.5 0 0 1 3 16.5 V7.5 A1.5 1.5 0 0 1 4.5 6 Z"
            {...stroke}
          />
          <Path d="M3.8 7 L12 13 L20.2 7" {...stroke} />
        </>
      )}
      {name === 'rewind' && (
        <>
          {/* A turn back: an open circle with its arrow head at the top left. */}
          <Path d="M5.5 9.5 A7.5 7.5 0 1 1 5 14.5" {...stroke} />
          <Path d="M4.5 4.8 V9.8 H9.5" {...stroke} />
        </>
      )}
      {name === 'waves' && (
        <>
          <Path d="M3 9 Q 6 6.5, 9 9 T 15 9 T 21 9" {...stroke} />
          <Path d="M3 14.5 Q 6 12, 9 14.5 T 15 14.5 T 21 14.5" {...stroke} opacity={0.7} />
        </>
      )}
      {name === 'captions' && (
        <>
          <Path
            d="M5 5.5 H19 A2 2 0 0 1 21 7.5 V16.5 A2 2 0 0 1 19 18.5 H5 A2 2 0 0 1 3 16.5 V7.5 A2 2 0 0 1 5 5.5 Z"
            {...stroke}
          />
          <Path d="M6.5 11 H11 M13 11 H17.5 M6.5 14.5 H14" {...stroke} strokeWidth={strokeWidth * 0.8} />
        </>
      )}
    </Svg>
  );
}
