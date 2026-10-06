import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import type { ZoneId } from '@/content/types';
import { LilyPad, Reeds, smoothPath } from '@/illustration';
import { palette } from '@/theme';

import type { ZoneLayout } from './layout';

/** Land, decoration and accent colours of each region of the river. */
export const ZONE_LOOK: Record<
  ZoneId | 'comingSoon',
  { land: string; landDeep: string; bush: string; bushLight: string; accent: string }
> = {
  intro: {
    land: '#D5E8C0',
    landDeep: '#BFDAA3',
    bush: palette.jungleMid,
    bushLight: palette.leaf,
    accent: palette.waterLily,
  },
  sleep: {
    land: '#C9DBD9',
    landDeep: '#AFC8C7',
    bush: palette.tealDeep,
    bushLight: '#3F7F6E',
    accent: palette.amberGlow,
  },
  stress: {
    land: '#DCE4DA',
    landDeep: '#CBD6C9',
    bush: '#7F978A',
    bushLight: '#9FB3A6',
    accent: '#E8EFE7',
  },
  confidence: {
    land: '#DEE3D8',
    landDeep: '#CDD5C6',
    bush: '#80968A',
    bushLight: '#A1B4A5',
    accent: '#E8EFE7',
  },
  focus: {
    land: '#DAE2DB',
    landDeep: '#C8D4CA',
    bush: '#7D958A',
    bushLight: '#9DB2A6',
    accent: '#E8EFE7',
  },
  habits: {
    land: '#DDE3D9',
    landDeep: '#CCD5C8',
    bush: '#7F978B',
    bushLight: '#A0B3A6',
    accent: '#E8EFE7',
  },
  comingSoon: {
    land: '#DCE3DD',
    landDeep: '#CBD5CD',
    bush: '#8A9E93',
    bushLight: '#A9B9AE',
    accent: '#EEF3EE',
  },
};

/** Small deterministic random numbers, so the scenery is the same on every render and device. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ZoneSceneryProps {
  zone: ZoneLayout;
  width: number;
  index: number;
}

/**
 * The static illustration of one region: land, a winding river with its banks, bushes, rocks,
 * flowers and a few lily pads and reeds. Drawn once per zone and memoised: scrolling the map
 * never re-renders it.
 */
export const ZoneScenery = memo(function ZoneScenery({ zone, width, index }: ZoneSceneryProps) {
  const look = ZONE_LOOK[zone.comingSoon ? 'comingSoon' : zone.zoneId];
  const { height } = zone;
  const river = useMemo(() => smoothPath(zone.river), [zone.river]);

  const decor = useMemo(() => {
    const rand = seeded(index * 977 + 13);
    const bushes: { x: number; y: number; r: number }[] = [];
    const rocks: { x: number; y: number; r: number }[] = [];
    const flowers: { x: number; y: number }[] = [];
    // Bushes along both edges, away from the river.
    for (let y = 30; y < height - 20; y += 70 + rand() * 50) {
      const left = rand() > 0.5;
      bushes.push({ x: left ? rand() * 36 : width - rand() * 36, y, r: 22 + rand() * 18 });
    }
    for (let i = 0; i < Math.round(height / 160); i++) {
      rocks.push({
        x: 24 + rand() * (width - 48),
        y: 40 + rand() * (height - 80),
        r: 6 + rand() * 7,
      });
    }
    for (let i = 0; i < Math.round(height / 60); i++) {
      flowers.push({ x: 12 + rand() * (width - 24), y: 20 + rand() * (height - 40) });
    }
    return { bushes, rocks, flowers };
  }, [index, height, width]);

  // A few pads and reeds beside the river, between the stops.
  const extras = useMemo(
    () =>
      zone.nodes.slice(0, -1).map((node, i) => {
        const next = zone.nodes[i + 1]!;
        return { x: (node.x + next.x) / 2, y: (node.y + next.y) / 2, flip: i % 2 === 0 };
      }),
    [zone.nodes],
  );

  return (
    <View style={[styles.root, { top: zone.top, width, height }]} pointerEvents="none">
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Rect x={0} y={0} width={width} height={height} fill={look.land} />
        {/* Soft darker meadow patches */}
        <Ellipse
          cx={width * 0.15}
          cy={height * 0.3}
          rx={width * 0.3}
          ry={60}
          fill={look.landDeep}
          opacity={0.6}
        />
        <Ellipse
          cx={width * 0.85}
          cy={height * 0.72}
          rx={width * 0.3}
          ry={70}
          fill={look.landDeep}
          opacity={0.6}
        />
        {decor.flowers.map((f, i) => (
          <G key={`f${i}`}>
            <Circle cx={f.x} cy={f.y} r={2.6} fill={look.accent} />
            <Circle cx={f.x + 5} cy={f.y + 3} r={2} fill={look.accent} opacity={0.8} />
          </G>
        ))}
        {zone.zoneId === 'sleep' && !zone.comingSoon ? (
          <G>
            <Path
              d={`M ${width - 64} 40 a 22 22 0 1 0 22 28 a 17 17 0 0 1 -22 -28 Z`}
              fill={palette.amberGlow}
            />
            {[0.2, 0.42, 0.7].map((fx, i) => (
              <Circle
                key={i}
                cx={width * fx}
                cy={30 + i * 14}
                r={2}
                fill={palette.white}
                opacity={0.9}
              />
            ))}
          </G>
        ) : null}
        {/* The river: bank edge, water, a lighter current and the dotted trail. */}
        <Path d={river} stroke="#5E9F8F" strokeWidth={78} fill="none" strokeLinecap="round" />
        <Path
          d={river}
          stroke={zone.comingSoon ? '#A9CFC6' : palette.shallows}
          strokeWidth={66}
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d={river}
          stroke={zone.comingSoon ? '#C2DDD6' : '#A6DCCF'}
          strokeWidth={30}
          fill="none"
          strokeLinecap="round"
          opacity={0.8}
        />
        <Path
          d={river}
          stroke={palette.white}
          strokeWidth={4}
          strokeDasharray="2 14"
          strokeLinecap="round"
          fill="none"
          opacity={0.85}
        />
        {decor.rocks.map((r, i) => (
          <G key={`r${i}`}>
            <Ellipse
              cx={r.x}
              cy={r.y + 2}
              rx={r.r * 1.3}
              ry={r.r * 0.8}
              fill="#6F7F74"
              opacity={0.35}
            />
            <Ellipse cx={r.x} cy={r.y} rx={r.r * 1.2} ry={r.r * 0.8} fill="#9AA79C" />
            <Ellipse
              cx={r.x - r.r * 0.3}
              cy={r.y - r.r * 0.3}
              rx={r.r * 0.5}
              ry={r.r * 0.25}
              fill="#C4CEC4"
            />
          </G>
        ))}
        {decor.bushes.map((b, i) => (
          <G key={`b${i}`}>
            <Circle cx={b.x} cy={b.y + 6} r={b.r} fill={look.bush} />
            <Circle cx={b.x - b.r * 0.6} cy={b.y + 10} r={b.r * 0.7} fill={look.bush} />
            <Circle cx={b.x + b.r * 0.5} cy={b.y - 4} r={b.r * 0.75} fill={look.bushLight} />
            <Circle
              cx={b.x + b.r * 0.3}
              cy={b.y - 8}
              r={b.r * 0.25}
              fill={palette.leafLight}
              opacity={0.5}
            />
          </G>
        ))}
      </Svg>
      {extras.map((e, i) =>
        i % 2 === 0 ? (
          <LilyPad
            key={`pad${i}`}
            size={40}
            flower={!zone.comingSoon && i % 4 === 0}
            rotation={i * 40}
            style={[styles.abs, { left: e.x + (e.flip ? 30 : -70), top: e.y - 20 }]}
          />
        ) : (
          <Reeds
            key={`reed${i}`}
            width={46}
            height={64}
            count={4}
            flip={e.flip}
            animated={false}
            style={[styles.abs, { left: e.flip ? e.x + 44 : e.x - 90, top: e.y - 54 }]}
          />
        ),
      )}
      {zone.comingSoon ? <View style={[StyleSheet.absoluteFill, styles.mist]} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, overflow: 'hidden' },
  abs: { position: 'absolute' },
  mist: { backgroundColor: 'rgba(240, 245, 241, 0.55)' },
});
