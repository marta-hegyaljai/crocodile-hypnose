import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { CrocExpression, CrocStage } from '../croc/types';
import { decorative } from '../scene/decorative';
import { Lagoon } from '../scene/Lagoon';
import { Decoration } from './Decoration';

/** Where each slot sits in the scene: centre x as a fraction, y as a fraction, size factor. */
const SLOT_PLACES: Record<string, { x: number; y: number; scale: number; front?: boolean }> = {
  back: { x: 0.16, y: 0.36, scale: 0.95 },
  air: { x: 0.8, y: 0.16, scale: 0.8 },
  'water-left': { x: 0.17, y: 0.62, scale: 0.85, front: true },
  'water-right': { x: 0.83, y: 0.6, scale: 0.85, front: true },
  'water-front': { x: 0.5, y: 0.8, scale: 0.8, front: true },
  'bank-left': { x: 0.08, y: 0.4, scale: 0.9 },
  'bank-right': { x: 0.92, y: 0.4, scale: 0.9 },
};

export interface HabitatSceneProps {
  width: number;
  height: number;
  stage: CrocStage;
  expression?: CrocExpression;
  /** Slot id to decoration id (or null). */
  slots: Record<string, string | null>;
  crocName?: string;
  celebrate?: boolean;
  animated?: boolean;
  testID?: string;
}

/**
 * The croc's lagoon with the decorations the user placed, each in its fixed slot. The far-bank
 * pieces sit behind the water line, the water pieces float in front of the croc.
 */
export function HabitatScene({
  width,
  height,
  stage,
  expression = 'happy',
  slots,
  crocName,
  celebrate = false,
  animated = true,
  testID,
}: HabitatSceneProps) {
  const base = Math.min(Math.round(width * 0.26), 150);
  const placed = Object.entries(slots).filter((e): e is [string, string] => !!e[1]);
  const draw = (front: boolean) =>
    placed
      .filter(([slot]) => !!SLOT_PLACES[slot] && !!SLOT_PLACES[slot]!.front === front)
      .map(([slot, itemId]) => {
        const p = SLOT_PLACES[slot]!;
        const size = Math.round(base * p.scale);
        return (
          <Decoration
            key={slot}
            id={itemId}
            size={size}
            style={{
              position: 'absolute',
              left: Math.round(width * p.x - size / 2),
              top: Math.round(height * p.y - size / 2),
            }}
            testID={testID ? `${testID}-item-${itemId}` : undefined}
          />
        );
      });
  return (
    <View style={{ width, height }} testID={testID}>
      <Lagoon
        width={width}
        height={height}
        stage={stage}
        expression={expression}
        waterTop={0.5}
        crocX={0.5}
        crocWidth={Math.min(Math.round(width * 0.62), 360)}
        farReeds={false}
        celebrate={celebrate}
        celebrationScale={1.3}
        crocName={crocName}
        animated={animated}
      />
      <View style={StyleSheet.absoluteFill} pointerEvents="none" {...decorative}>
        {draw(false)}
      </View>
      <View style={StyleSheet.absoluteFill} pointerEvents="none" {...decorative}>
        {draw(true)}
      </View>
    </View>
  );
}
