import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/copy';
import { durationLabel } from '@/features/map/stopLabels';
import {
  Croc,
  FIGURE_H,
  FIGURE_TOP,
  FIGURE_W,
  FarJungle,
  Fireflies,
  GROUND_Y,
  JungleLeaves,
  LilyPad,
  Reeds,
  SkyGlow,
} from '@/illustration';
import { palette, radius, space, useTheme } from '@/theme';
import { Card, Chip, Icon, Screen, Text } from '@/ui';

import { GAMES, type GameDef, type GameId } from './catalog';
import { GAME_ICONS, GAME_TINTS } from './gameArt';
import type { GameRecords } from './records';
import { resultLabel } from './resultLabel';

export interface GamesClearingProps {
  records: GameRecords;
  crocName: string;
  onOpen: (gameId: GameId) => void;
}

/**
 * The games clearing: a sunny gap in the jungle with a pond, the croc sitting on the grass, and
 * one pebble card per game with how often it was played and the best result.
 */
export function GamesClearing({ records, crocName, onOpen }: GamesClearingProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const short = height < 700;
  // Tablets get a taller clearing and a bigger croc so the scene is not a thin band over empty space.
  const wide = width >= 700;
  const sceneH = Math.round(Math.min(short ? height * 0.36 : height * 0.42, wide ? 460 : 360));
  const grassY = Math.round(sceneH * 0.68);
  // The croc sits on the grass at full size, its feet (GROUND_Y of the figure) on the grass line.
  // The full-pose drawing's viewBox starts at FIGURE_TOP (see geometry.ts).
  const crocW = Math.min(Math.round(width * 0.72), wide ? 520 : 320);
  const crocH = (crocW * (FIGURE_H - FIGURE_TOP)) / FIGURE_W;
  const crocTop = Math.round(
    grassY - (crocH * (GROUND_Y - FIGURE_TOP)) / (FIGURE_H - FIGURE_TOP) + 4,
  );

  return (
    <Screen padded={false} edges={[]} testID="games-screen" contentStyle={styles.content}>
      <View style={[styles.scene, { height: sceneH }]} pointerEvents="none">
        <Svg width={width} height={sceneH} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="clearing-sky" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.background} />
              <Stop offset="1" stopColor={palette.mistLight} />
            </LinearGradient>
            <LinearGradient id="clearing-grass" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#9FCB7A" />
              <Stop offset="1" stopColor={palette.leaf} />
            </LinearGradient>
          </Defs>
          <Rect width={width} height={sceneH} fill="url(#clearing-sky)" />
          {/* The grass of the clearing, rolling down to a small pond at the right. */}
          <Path
            d={`M0 ${grassY + 10} Q ${width * 0.3} ${grassY - 18} ${width * 0.55} ${grassY} T ${width} ${grassY - 6} V ${sceneH} H0 Z`}
            fill="url(#clearing-grass)"
          />
          <Ellipse
            cx={width * 0.8}
            cy={sceneH * 0.9}
            rx={width * 0.26}
            ry={sceneH * 0.1}
            fill={colors.water}
            opacity={0.9}
          />
          <Ellipse
            cx={width * 0.8}
            cy={sceneH * 0.9}
            rx={width * 0.22}
            ry={sceneH * 0.07}
            fill={colors.waterLight}
            opacity={0.35}
          />
        </Svg>
        <SkyGlow
          size={Math.round(width * 0.9)}
          style={{ position: 'absolute', left: width * 0.3, top: -width * 0.42 }}
        />
        <FarJungle
          width={width + 40}
          height={Math.round(sceneH * 0.5)}
          style={{ position: 'absolute', left: -20, top: grassY - Math.round(sceneH * 0.5) + 14 }}
        />
        <Fireflies count={6} intensity={0.6} color={palette.mistLight} scale={0.8} />
        <Reeds
          count={4}
          width={wide ? 120 : 90}
          height={wide ? 134 : 100}
          style={{ position: 'absolute', right: 8, top: grassY - (wide ? 94 : 70) }}
          tone="light"
          flip
        />
        <LilyPad
          size={wide ? 60 : 44}
          flower
          style={{ position: 'absolute', left: width * 0.72, top: sceneH * 0.84 }}
          rotation={-20}
        />
        <View style={{ position: 'absolute', left: width * 0.1, top: crocTop }}>
          <Croc
            stage="hatchling"
            expression="excited"
            pose="full"
            width={crocW}
            relativeSize={false}
            name={crocName}
            testID="clearing-croc"
          />
        </View>
        <JungleLeaves
          corner="top-left"
          size={Math.round(Math.min(width * 0.26, sceneH * 0.5))}
          style={styles.topLeft}
        />
        <JungleLeaves
          corner="top-right"
          size={Math.round(Math.min(width * 0.22, sceneH * 0.45))}
          style={styles.topRight}
        />
      </View>
      <View style={[styles.header, { paddingTop: insets.top + space.lg }]} pointerEvents="none">
        <Text variant="title" heading align="center">
          {t('games.clearing.title')}
        </Text>
        <Text variant="body" tone="secondary" align="center">
          {t('games.clearing.body')}
        </Text>
      </View>
      {/* Tablets: the three cards side by side instead of a short column over empty ground. */}
      <View
        style={[
          styles.list,
          wide && styles.listRow,
          { paddingBottom: insets.bottom + space.xxl, maxWidth: wide ? 820 : 560 },
        ]}
      >
        {GAMES.map((game) => (
          <View key={game.id} style={wide ? styles.listCell : undefined}>
            <GameCard game={game} record={records[game.id]} onOpen={onOpen} />
          </View>
        ))}
      </View>
    </Screen>
  );
}

function GameCard({
  game,
  record,
  onOpen,
}: {
  game: GameDef;
  record: GameRecords[GameId];
  onOpen: (gameId: GameId) => void;
}) {
  const plays =
    record.plays === 0
      ? t('games.clearing.neverPlayed')
      : record.plays === 1
        ? t('games.clearing.playsOne')
        : t('games.clearing.plays', { n: record.plays });
  const title = t(game.titleKey);
  const tint = GAME_TINTS[game.id];
  return (
    <Card
      onPress={() => onOpen(game.id)}
      textured
      accessibilityLabel={t('games.clearing.a11yCard', {
        title,
        duration: durationLabel(game.durationSec),
        plays,
      })}
      testID={`game-card-${game.id}`}
    >
      <View style={styles.row}>
        <View style={[styles.badge, { backgroundColor: tint.bg }]}>
          <Icon name={GAME_ICONS[game.id]} size={28} color={tint.fg} />
        </View>
        <View style={styles.meta}>
          <Text variant="heading" heading numberOfLines={1}>
            {title}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {t(game.skillKey)}
          </Text>
        </View>
        <Icon name="play" size={22} color={palette.crocGreen} />
      </View>
      <View style={styles.chips}>
        <Chip label={durationLabel(game.durationSec)} tone="neutral" />
        <Chip
          label={plays}
          tone={record.plays > 0 ? 'goal' : 'neutral'}
          icon={record.plays > 0 ? 'check' : undefined}
          testID={`game-card-${game.id}-plays`}
        />
        {record.best ? (
          <Chip
            label={t('games.clearing.best', { result: resultLabel(record.best) })}
            tone="points"
            icon="sparkle"
            testID={`game-card-${game.id}-best`}
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 0 },
  scene: { width: '100%', overflow: 'hidden' },
  topLeft: { position: 'absolute', left: 0, top: 0 },
  topRight: { position: 'absolute', right: 0, top: 0 },
  header: {
    position: 'absolute',
    left: space.xl,
    right: space.xl,
    gap: space.xs,
  },
  list: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    gap: space.md,
    marginTop: -radius.lg,
  },
  listRow: { flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: space.xl },
  listCell: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flex: 1, gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
});
