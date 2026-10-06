import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import type { ZoneId } from '@/content/types';
import { LilyPad, Reeds, smoothPath } from '@/illustration';
import { palette } from '@/theme';

import type { ZoneLayout } from './layout';

/** Land, decoration and accent colours of each region of the river. */
export const ZONE_LOOK: Record<
  ZoneId,
  { land: string; landDeep: string; bush: string; bushLight: string; accent: string }
> = {
  // A sunny meadow by the water.
  intro: {
    land: '#D5E8C0',
    landDeep: '#BFDAA3',
    bush: palette.jungleMid,
    bushLight: palette.leaf,
    accent: palette.waterLily,
  },
  // Dusk: cool teal banks under the moon.
  sleep: {
    land: '#C9DBD9',
    landDeep: '#AFC8C7',
    bush: palette.tealDeep,
    bushLight: '#3F7F6E',
    accent: palette.amberGlow,
  },
  // A still, stony shore in lavender grey.
  stress: {
    land: '#D9DCE4',
    landDeep: '#C4C9D6',
    bush: '#6F7E93',
    bushLight: '#8E9DB1',
    accent: '#EEF0F5',
  },
  // Warm sand under a bright sun.
  confidence: {
    land: '#E6DEC6',
    landDeep: '#D6CBA9',
    bush: '#8C8A5C',
    bushLight: '#ACA974',
    accent: '#FFF0C9',
  },
  // A pine forest in deep green-grey.
  focus: {
    land: '#CFDBD0',
    landDeep: '#B8C9BA',
    bush: '#4F6F5C',
    bushLight: '#6B8C76',
    accent: '#E9F1EA',
  },
  // Olive banks and a footbridge.
  habits: {
    land: '#DCE0C8',
    landDeep: '#C9CFAB',
    bush: '#6E7F4E',
    bushLight: '#8F9F68',
    accent: '#F3F4E4',
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

/** How far a zone's land reaches up over the zone above it, so the two blend along a wavy shore. */
export const ZONE_OVERLAP = 44;

/** A wavy line across the full width around y = 0 (in the zone's own coordinates), closed below. */
function shoreline(width: number, height: number, seed: number): string {
  const rand = seeded(seed);
  const n = Math.max(4, Math.round(width / 90));
  const step = width / n;
  let d = `M -4 ${-6 + rand() * 8}`;
  for (let i = 0; i < n; i++) {
    const x0 = i * step;
    const amp = 10 + rand() * 16;
    const up = i % 2 === 0 ? -amp : amp;
    d += ` Q ${x0 + step / 2} ${up} ${x0 + step} ${(rand() - 0.5) * 6}`;
  }
  d += ` L ${width + 4} ${height + 4} L -4 ${height + 4} Z`;
  return d;
}

export interface ZoneSceneryProps {
  zone: ZoneLayout;
  width: number;
  index: number;
  /** Map scale from the layout (bigger props on tablets). */
  scale?: number;
}

/** The one thing each region is known for: drawn once near the top, away from the river. */
function Signature({ zoneId, width, scale: s }: { zoneId: ZoneId; width: number; scale: number }) {
  switch (zoneId) {
    case 'intro':
      // A warm sun with soft rays.
      return (
        <G transform={`translate(${width - 66 * s} ${56 * s})`}>
          {Array.from({ length: 8 }, (_, i) => (
            <Path
              key={i}
              d={`M 0 ${-30 * s} L 0 ${-40 * s}`}
              stroke={palette.amberLight}
              strokeWidth={4 * s}
              strokeLinecap="round"
              opacity={0.8}
              transform={`rotate(${i * 45})`}
            />
          ))}
          <Circle r={22 * s} fill={palette.amberLight} />
          <Circle r={16 * s} fill={palette.amberGlow} opacity={0.9} />
        </G>
      );
    case 'sleep':
      // The moon and a few stars.
      return (
        <G>
          <Path
            d={`M ${width - 64 * s} ${40 * s} a ${22 * s} ${22 * s} 0 1 0 ${22 * s} ${28 * s} a ${17 * s} ${17 * s} 0 0 1 ${-22 * s} ${-28 * s} Z`}
            fill={palette.amberGlow}
          />
          {[0.2, 0.42, 0.7, 0.55, 0.3].map((fx, i) => (
            <Circle
              key={i}
              cx={width * fx}
              cy={(30 + (i % 3) * 14 + (i > 2 ? 90 : 0)) * s}
              r={i % 2 === 0 ? 2.2 : 1.6}
              fill={palette.white}
              opacity={0.9}
            />
          ))}
        </G>
      );
    case 'stress':
      // A cairn of balanced stones by the water.
      return (
        <G transform={`translate(${38 * s} ${150 * s})`}>
          <Ellipse cx={0} cy={8 * s} rx={30 * s} ry={9 * s} fill="#6F7F74" opacity={0.25} />
          <Ellipse cx={0} cy={0} rx={24 * s} ry={11 * s} fill="#8C97A3" />
          <Ellipse cx={2 * s} cy={-16 * s} rx={18 * s} ry={9 * s} fill="#A3ADB8" />
          <Ellipse cx={-1 * s} cy={-29 * s} rx={12 * s} ry={7 * s} fill="#B8C0CA" />
          <Ellipse cx={1 * s} cy={-39 * s} rx={7 * s} ry={4.5 * s} fill="#CDD3DB" />
        </G>
      );
    case 'confidence':
      // A big bright sun rising over the sand.
      return (
        <G transform={`translate(${width - 60 * s} ${64 * s})`}>
          <Circle r={34 * s} fill={palette.amberGlow} opacity={0.45} />
          <Circle r={24 * s} fill={palette.amberLight} />
          <Circle r={17 * s} fill={palette.amberGlow} />
        </G>
      );
    case 'focus':
      // Tall pines on the far bank.
      return (
        <G transform={`translate(${width - 70 * s} ${70 * s})`}>
          {[-28, 0, 26].map((dx, i) => {
            const h = (54 + (i === 1 ? 22 : 0)) * s;
            const w = 20 * s;
            return (
              <G key={i} transform={`translate(${dx * s} 0)`}>
                <Rect x={-2.5 * s} y={0} width={5 * s} height={16 * s} fill={palette.mudDark} />
                <Path d={`M 0 ${-h} L ${w} 4 L ${-w} 4 Z`} fill="#3E6A50" />
                <Path
                  d={`M 0 ${-h} L ${w * 0.8} ${-h * 0.35} L ${-w * 0.8} ${-h * 0.35} Z`}
                  fill="#5B8A69"
                />
              </G>
            );
          })}
        </G>
      );
    case 'habits':
      // A little wooden footbridge over the river's entrance.
      return (
        <G transform={`translate(${width / 2} ${ZONE_OVERLAP + 10})`}>
          <Rect
            x={-64 * s}
            y={-6 * s}
            width={128 * s}
            height={12 * s}
            rx={4 * s}
            fill={palette.riverbankMud}
          />
          {Array.from({ length: 7 }, (_, i) => (
            <Rect
              key={i}
              x={(-58 + i * 19) * s}
              y={-5 * s}
              width={10 * s}
              height={10 * s}
              fill={palette.mudDark}
              opacity={0.35}
            />
          ))}
          <Path
            d={`M ${-64 * s} ${-14 * s} L ${64 * s} ${-14 * s}`}
            stroke={palette.mudDark}
            strokeWidth={3 * s}
            strokeLinecap="round"
          />
          {[-56, -28, 0, 28, 56].map((x) => (
            <Rect
              key={x}
              x={(x - 1.5) * s}
              y={-16 * s}
              width={3 * s}
              height={12 * s}
              fill={palette.mudDark}
            />
          ))}
        </G>
      );
  }
}

/**
 * The static illustration of one region: land that blends into the region above along a wavy
 * shore, a winding river with its banks, bushes, rocks, flowers, a few lily pads and reeds, and
 * the one prop the region is known for. Drawn once per zone and memoised: scrolling the map never
 * re-renders it.
 */
export const ZoneScenery = memo(function ZoneScenery({
  zone,
  width,
  index,
  scale = 1,
}: ZoneSceneryProps) {
  const look = ZONE_LOOK[zone.zoneId];
  const { height } = zone;
  // The first zone starts at the top edge; every other one reaches up over the zone before it.
  const overlap = index === 0 ? 0 : ZONE_OVERLAP;
  const canvasH = height + overlap;
  const river = useMemo(
    () => smoothPath([{ x: width / 2, y: -overlap - 20 }, ...zone.river]),
    [zone.river, width, overlap],
  );
  const shore = useMemo(
    () => (overlap ? shoreline(width, canvasH, index * 31 + 7) : null),
    [overlap, width, canvasH, index],
  );

  const decor = useMemo(() => {
    const rand = seeded(index * 977 + 13);
    const bushes: { x: number; y: number; r: number }[] = [];
    const rocks: { x: number; y: number; r: number }[] = [];
    const flowers: { x: number; y: number }[] = [];
    const edge = 40 * scale;
    // Bushes along both edges, away from the river.
    for (let y = 30; y < height - 20; y += (70 + rand() * 50) * scale) {
      const left = rand() > 0.5;
      bushes.push({
        x: left ? rand() * edge : width - rand() * edge,
        y,
        r: (22 + rand() * 18) * scale,
      });
    }
    for (let i = 0; i < Math.round(height / 160); i++) {
      rocks.push({
        x: 24 + rand() * (width - 48),
        y: 40 + rand() * (height - 80),
        r: (6 + rand() * 7) * scale,
      });
    }
    for (let i = 0; i < Math.round(height / 60); i++) {
      flowers.push({ x: 12 + rand() * (width - 24), y: 20 + rand() * (height - 40) });
    }
    return { bushes, rocks, flowers };
  }, [index, height, width, scale]);

  // A few pads and reeds beside the river, between the stops.
  const extras = useMemo(
    () =>
      zone.nodes.slice(0, -1).map((node, i) => {
        const next = zone.nodes[i + 1]!;
        return { x: (node.x + next.x) / 2, y: (node.y + next.y) / 2, flip: i % 2 === 0 };
      }),
    [zone.nodes],
  );

  const bank = 96 * scale;
  const water = 84 * scale;
  const current = 40 * scale;
  const mist = zone.comingSoon;
  const mistFill = 'rgba(240, 245, 241, 0.5)';

  return (
    <View
      style={[styles.root, { top: zone.top - overlap, width, height: canvasH }]}
      pointerEvents="none"
    >
      <Svg width={width} height={canvasH} viewBox={`0 ${-overlap} ${width} ${canvasH}`}>
        {shore ? (
          <>
            {/* A lighter rim just above the shore, so the two lands blend like a tide line. */}
            <Path d={shore} fill={look.landDeep} opacity={0.55} transform="translate(0 -6)" />
            <Path d={shore} fill={look.land} />
          </>
        ) : (
          <Rect x={0} y={-overlap} width={width} height={canvasH} fill={look.land} />
        )}
        {/* Soft darker meadow patches */}
        <Ellipse
          cx={width * 0.15}
          cy={height * 0.3}
          rx={width * 0.3}
          ry={60 * scale}
          fill={look.landDeep}
          opacity={0.6}
        />
        <Ellipse
          cx={width * 0.85}
          cy={height * 0.72}
          rx={width * 0.3}
          ry={70 * scale}
          fill={look.landDeep}
          opacity={0.6}
        />
        {decor.flowers.map((f, i) => (
          <G key={`f${i}`}>
            <Circle cx={f.x} cy={f.y} r={2.6} fill={look.accent} />
            <Circle cx={f.x + 5} cy={f.y + 3} r={2} fill={look.accent} opacity={0.8} />
          </G>
        ))}
        <Signature zoneId={zone.zoneId} width={width} scale={scale} />
        {/* The river: bank edge, water, a lighter current and the dotted trail. */}
        <Path d={river} stroke="#5E9F8F" strokeWidth={bank} fill="none" strokeLinecap="round" />
        <Path
          d={river}
          stroke={mist ? '#A9CFC6' : palette.shallows}
          strokeWidth={water}
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d={river}
          stroke={mist ? '#C2DDD6' : '#A6DCCF'}
          strokeWidth={current}
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
            <Ellipse
              cx={b.x}
              cy={b.y + b.r * 0.9}
              rx={b.r * 1.3}
              ry={b.r * 0.35}
              fill={palette.deepJungle}
              opacity={0.12}
            />
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
      <View style={mist ? styles.misted : undefined}>
        {extras.map((e, i) =>
          i % 2 === 0 ? (
            <LilyPad
              key={`pad${i}`}
              size={40 * scale}
              flower={!mist && i % 4 === 0}
              rotation={i * 40}
              style={[
                styles.abs,
                {
                  left: e.x + (e.flip ? 34 * scale : -74 * scale),
                  top: overlap + e.y - 20 * scale,
                },
              ]}
            />
          ) : (
            <Reeds
              key={`reed${i}`}
              width={46 * scale}
              height={64 * scale}
              count={4}
              flip={e.flip}
              animated={false}
              style={[
                styles.abs,
                {
                  left: e.flip ? e.x + 50 * scale : e.x - 96 * scale,
                  top: overlap + e.y - 54 * scale,
                },
              ]}
            />
          ),
        )}
      </View>
      {mist ? (
        // The mist follows the same wavy shore, so no straight edge shows between regions.
        <Svg
          width={width}
          height={canvasH}
          viewBox={`0 ${-overlap} ${width} ${canvasH}`}
          style={StyleSheet.absoluteFill}
        >
          {shore ? (
            <Path d={shore} fill={mistFill} />
          ) : (
            <Rect x={0} y={-overlap} width={width} height={canvasH} fill={mistFill} />
          )}
        </Svg>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, overflow: 'hidden' },
  abs: { position: 'absolute' },
  misted: { opacity: 0.6 },
});
