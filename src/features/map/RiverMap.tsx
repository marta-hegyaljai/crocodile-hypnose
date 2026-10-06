import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { t } from '@/copy';
import type { Journey, StopView } from '@/content/journey';
import { localContent, type ContentRepository } from '@/content/repository';
import Svg, { Ellipse } from 'react-native-svg';

import { CelebrationBurst, Croc, useLoop, type CrocStage } from '@/illustration';
import { decorative } from '@/illustration/scene/decorative';
import { useReducedMotion } from '@/motion/MotionProvider';
import { palette, radius, space } from '@/theme';
import { Text } from '@/ui';

import { layoutMap, nodeY, type MapLayout } from './layout';
import { StopNode } from './StopNode';
import { stopA11yLabel } from './stopLabels';
import { ZoneScenery } from './ZoneScenery';
import { ZoneSign } from './ZoneSign';

export interface RiverMapProps {
  journey: Journey;
  /** Where the user's croc sits (today's session), if anywhere. */
  currentStopId: string | null;
  crocName: string;
  crocStage: CrocStage;
  onStopPress: (view: StopView) => void;
  /** Space kept free under the last zone (e.g. for the tab bar). */
  bottomInset?: number;
  /** False while another screen covers the map: scrolling waits until it is visible again. */
  active?: boolean;
  /** The content the journey was derived from (its zones and stops, in the same order). */
  content?: ContentRepository;
  testID?: string;
}

/** The croc's width on the map: a proper hero next to the nodes, bigger on tablets. */
function crocWidth(layout: MapLayout): number {
  return Math.round(Math.max(170, Math.min(layout.width * 0.5, 200 * layout.scale)));
}

/** The full-pose drawing's height per point of width (see geometry.ts FIGURE_W / FIGURE_H). */
const CROC_ASPECT = 0.34;

interface CrocSpot {
  x: number;
  y: number;
  /** True when the croc sits right of its node and looks left, towards it. */
  flip: boolean;
  /** Where the "You are here" tag hangs: centred over the node. */
  tagX: number;
  tagY: number;
}

/**
 * Where the croc sits for a stop: on the water beside its node, on the side with more room,
 * looking at the stop. `h` is the croc's drawn height.
 */
function crocSpot(layout: MapLayout, stopId: string, w: number, h: number): CrocSpot | null {
  for (const zone of layout.zones) {
    const node = zone.nodes.find((n) => n.stopId === stopId);
    if (!node) continue;
    const right = node.x < layout.width / 2;
    const raw = right ? node.x + node.size / 2 - 14 : node.x - node.size / 2 - w + 14;
    const x = Math.round(Math.max(2, Math.min(layout.width - w - 2, raw)));
    return {
      x,
      y: Math.round(zone.top + node.y - h / 2 + 2),
      flip: right,
      tagX: node.x,
      tagY: zone.top + node.y - node.size / 2 - 12,
    };
  }
  return null;
}

/**
 * The user's croc, sitting on the water at the current stop: a slow idle bob and blink (from the
 * croc itself), a ripple spreading on the water under it, and a "You are here" tag over the node.
 * It swims to the next stop when that changes (a spring; a jump with reduced motion).
 */
function MapCroc({
  layout,
  stopId,
  name,
  stage,
}: {
  layout: MapLayout;
  stopId: string;
  name: string;
  stage: CrocStage;
}) {
  const reduced = useReducedMotion();
  const w = crocWidth(layout);
  const h = Math.round(w * CROC_ASPECT);
  const target = crocSpot(layout, stopId, w, h);
  const x = useSharedValue(target?.x ?? 0);
  const y = useSharedValue(target?.y ?? 0);
  const tagX = useSharedValue(target?.tagX ?? 0);
  const tagY = useSharedValue(target?.tagY ?? 0);
  const placed = useRef(false);
  const tx = target?.x ?? null;
  const ty = target?.y ?? null;
  const ttx = target?.tagX ?? 0;
  const tty = target?.tagY ?? 0;
  useEffect(() => {
    if (tx === null || ty === null) return;
    if (!placed.current || reduced) {
      x.value = withTiming(tx, { duration: 0 });
      y.value = withTiming(ty, { duration: 0 });
      tagX.value = withTiming(ttx, { duration: 0 });
      tagY.value = withTiming(tty, { duration: 0 });
      placed.current = true;
      return;
    }
    const spring = { damping: 18, stiffness: 90 };
    x.value = withSpring(tx, spring);
    y.value = withSpring(ty, spring);
    tagX.value = withSpring(ttx, spring);
    tagY.value = withSpring(tty, spring);
  }, [tx, ty, ttx, tty, reduced, x, y, tagX, tagY]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));
  const tagStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tagX.value }, { translateY: tagY.value }],
  }));
  const ripple = useLoop(!reduced, 3000);
  const rippleStyle = useAnimatedStyle(() =>
    reduced
      ? { opacity: 0.55 }
      : {
          opacity: 0.75 * (1 - ripple.value),
          transform: [{ scale: 0.75 + ripple.value * 0.6 }],
        },
  );
  if (!target) return null;
  const rw = w * 0.6;
  const rh = h * 0.5;
  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.crocLayer, { width: w, height: h }, style]}
        {...decorative}
      >
        {/* A ripple on the water under the croc. */}
        <Animated.View
          style={[styles.ripple, { left: (w - rw) / 2, top: h - rh * 0.8 }, rippleStyle]}
        >
          <Svg width={rw} height={rh} viewBox={`0 0 ${rw} ${rh}`}>
            <Ellipse
              cx={rw / 2}
              cy={rh / 2}
              rx={rw / 2 - 2}
              ry={rh / 2 - 2}
              fill="none"
              stroke={palette.white}
              strokeWidth={2.5}
            />
          </Svg>
        </Animated.View>
      </Animated.View>
      {/* Decorative here: the current stop's label already says "You are here". */}
      <Animated.View
        style={[styles.crocLayer, { width: w, height: h }, style]}
        pointerEvents="none"
        testID="map-croc"
        {...decorative}
      >
        <View style={[styles.crocBody, target.flip && styles.flip]}>
          <Croc
            stage={stage}
            expression="happy"
            width={w}
            name={name}
            relativeSize={false}
            groundShadow={false}
          />
        </View>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.tagLayer, tagStyle]} {...decorative}>
        <View style={styles.hereTag}>
          <Text variant="label" color={palette.amberInk} numberOfLines={1}>
            {t('map.current')}
          </Text>
        </View>
        <View style={styles.hereTip} />
      </Animated.View>
    </>
  );
}

/** A burst of petals and sparkles at a zone's finale node the moment the zone is finished. */
function ZoneBurst({ x, y, radius }: { x: number; y: number; radius: number }) {
  return <CelebrationBurst active x={x} y={y} radius={radius} testID="zone-burst" />;
}

/**
 * The river map: one illustrated region per zone, stops as nodes along a winding river, the
 * user's croc at the current stop. Auto-scrolls to the current stop when it first appears and
 * whenever it moves. Each zone's scenery and each node are memoised, so scrolling and a progress
 * change only touch what changed.
 */
export function RiverMap({
  journey,
  currentStopId,
  crocName,
  crocStage,
  onStopPress,
  bottomInset = 0,
  content = localContent,
  active = true,
  testID,
}: RiverMapProps) {
  const reduced = useReducedMotion();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const scroll = useRef<ScrollView>(null);
  const scrolledTo = useRef<string | null>(null);

  // The layout depends on the content only, never on progress: it is computed once per width.
  const zonesInput = useMemo(
    () =>
      content.zones().map((zone) => ({
        zoneId: zone.id,
        comingSoon: zone.entry.kind === 'comingSoon',
        stops: content.stopsOf(zone.id).map((s) => ({ id: s.id, type: s.type })),
      })),
    [content],
  );
  const width = size?.width ?? 0;
  const layout = useMemo(() => layoutMap(zonesInput, width), [zonesInput, width]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    // A hidden screen (another screen on top, on web) measures as zero: keep the last real size.
    if (w <= 0 || h <= 0) return;
    setSize((prev) =>
      prev && prev.width === w && prev.height === h ? prev : { width: w, height: h },
    );
  }, []);

  // Bring the current stop into view: on first layout, and when the croc moves on.
  useEffect(() => {
    if (!active || !size || !currentStopId || scrolledTo.current === currentStopId) return;
    const y = nodeY(layout, currentStopId);
    if (y === null) return;
    const first = scrolledTo.current === null;
    // Leaving a zone that was just finished: stay for the celebration, then follow the croc.
    const prev = scrolledTo.current ? journey.byStopId.get(scrolledTo.current) : undefined;
    const next = journey.byStopId.get(currentStopId);
    const finishedZone =
      prev && next && prev.stop.zoneId !== next.stop.zoneId
        ? journey.zones.find((z) => z.zone.id === prev.stop.zoneId)
        : undefined;
    const linger = finishedZone && finishedZone.done === finishedZone.total && !reduced;
    scrolledTo.current = currentStopId;
    const offset = Math.max(0, y - size.height * 0.45);
    // Let the content lay out first (web measures after paint).
    const id = setTimeout(
      () => scroll.current?.scrollTo({ y: offset, animated: !first && !reduced }),
      linger ? 1900 : 0,
    );
    return () => clearTimeout(id);
  }, [active, size, layout, currentStopId, reduced, journey]);

  // A zone-complete moment: when a zone's count reaches its total (not on first render), petals
  // and sparkles burst from its finale node for a couple of seconds.
  const doneCounts = journey.zones.map((z) => `${z.done}/${z.total}`).join(',');
  const prevDone = useRef<string | null>(null);
  const [burst, setBurst] = useState<{ x: number; y: number; radius: number; key: number } | null>(
    null,
  );
  useEffect(() => {
    const prev = prevDone.current;
    prevDone.current = doneCounts;
    if (prev === null || prev === doneCounts) return;
    const before = prev.split(',');
    const index = journey.zones.findIndex(
      (z, i) => z.total > 0 && z.done === z.total && before[i] !== `${z.done}/${z.total}`,
    );
    if (index < 0) return;
    const zl = layout.zones[index];
    const last = zl?.nodes[zl.nodes.length - 1];
    if (!zl || !last) return;
    setBurst({
      x: last.x,
      y: zl.top + last.y,
      radius: Math.round(150 * layout.scale),
      key: Date.now(),
    });
    const id = setTimeout(() => setBurst(null), 2400);
    return () => clearTimeout(id);
  }, [doneCounts, journey.zones, layout]);

  const handlePress = useCallback(
    (stopId: string) => {
      const view = journey.byStopId.get(stopId);
      if (view) onStopPress(view);
    },
    [journey, onStopPress],
  );

  return (
    <View style={styles.root} onLayout={onLayout} testID={testID}>
      {size ? (
        <ScrollView
          ref={scroll}
          style={styles.root}
          contentContainerStyle={{ height: layout.height + bottomInset }}
          showsVerticalScrollIndicator={false}
          accessibilityLabel={t('map.a11y')}
          testID={testID ? `${testID}-scroll` : undefined}
        >
          {layout.zones.map((zl, index) => (
            <ZoneScenery
              key={zl.zoneId}
              zone={zl}
              width={width}
              index={index}
              scale={layout.scale}
            />
          ))}
          {layout.zones.map((zl, index) => {
            const view = journey.zones[index]!;
            const title = t(view.zone.titleKey);
            return (
              <React.Fragment key={`nodes-${zl.zoneId}`}>
                <ZoneSign
                  title={title}
                  state={view.state}
                  done={view.done}
                  total={view.total}
                  top={zl.top}
                  width={width}
                />
                {view.state === 'comingSoon'
                  ? zl.nodes.map((n) => (
                      <View
                        key={n.stopId}
                        pointerEvents="none"
                        style={[
                          styles.ghost,
                          {
                            left: n.x - n.size / 2,
                            top: zl.top + n.y - n.size / 2,
                            width: n.size,
                            height: n.size,
                            borderRadius: n.size / 2,
                          },
                        ]}
                      />
                    ))
                  : zl.nodes.map((n, i) => {
                      const sv = view.stops[i]!;
                      const current = sv.stop.id === currentStopId;
                      return (
                        <StopNode
                          key={n.stopId}
                          stopId={n.stopId}
                          type={sv.stop.type}
                          status={sv.status}
                          current={current}
                          x={n.x}
                          y={zl.top + n.y}
                          size={n.size}
                          accessibilityLabel={stopA11yLabel(sv, current)}
                          onPress={handlePress}
                        />
                      );
                    })}
              </React.Fragment>
            );
          })}
          {currentStopId ? (
            <MapCroc layout={layout} stopId={currentStopId} name={crocName} stage={crocStage} />
          ) : null}
          {burst ? (
            <ZoneBurst key={burst.key} x={burst.x} y={burst.y} radius={burst.radius} />
          ) : null}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  crocLayer: { position: 'absolute', left: 0, top: 0 },
  crocBody: { width: '100%', height: '100%' },
  flip: { transform: [{ scaleX: -1 }] },
  ripple: { position: 'absolute' },
  // The tag's layer sits on the node's centre line; the tag is centred on it and hangs upwards.
  tagLayer: { position: 'absolute', left: -90, top: 0, width: 180, alignItems: 'center' },
  hereTag: {
    backgroundColor: palette.amber,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 3,
    marginTop: -32,
    borderBottomWidth: 2,
    borderColor: palette.amberDeep,
  },
  hereTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: palette.amberDeep,
  },
  ghost: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 2,
    borderColor: 'rgba(120,140,128,0.35)',
    borderStyle: 'dashed',
  },
});
