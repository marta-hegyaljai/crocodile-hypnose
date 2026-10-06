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
import { Croc, type CrocStage } from '@/illustration';
import { decorative } from '@/illustration/scene/decorative';
import { useReducedMotion } from '@/motion/MotionProvider';

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

const CROC_W = 112;

/** Where the croc sits for a stop: beside its node, on the side with more room. */
function crocSpot(layout: MapLayout, stopId: string): { x: number; y: number } | null {
  for (const zone of layout.zones) {
    const node = zone.nodes.find((n) => n.stopId === stopId);
    if (!node) continue;
    const right = node.x < layout.width / 2;
    const x = right ? node.x + node.size / 2 - 6 : node.x - node.size / 2 - CROC_W + 6;
    return { x, y: zone.top + node.y - 34 };
  }
  return null;
}

/** The user's croc, sitting beside the current stop; it swims to the next one when that changes. */
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
  const target = crocSpot(layout, stopId);
  const x = useSharedValue(target?.x ?? 0);
  const y = useSharedValue(target?.y ?? 0);
  const placed = useRef(false);
  const tx = target?.x ?? null;
  const ty = target?.y ?? null;
  useEffect(() => {
    if (tx === null || ty === null) return;
    if (!placed.current || reduced) {
      x.value = withTiming(tx, { duration: 0 });
      y.value = withTiming(ty, { duration: 0 });
      placed.current = true;
      return;
    }
    x.value = withSpring(tx, { damping: 18, stiffness: 90 });
    y.value = withSpring(ty, { damping: 18, stiffness: 90 });
  }, [tx, ty, reduced, x, y]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));
  if (!target) return null;
  return (
    // Decorative here: the current stop's label already says "You are here".
    <Animated.View
      style={[styles.croc, style]}
      pointerEvents="none"
      testID="map-croc"
      {...decorative}
    >
      <Croc stage={stage} expression="happy" width={CROC_W} name={name} relativeSize={false} />
    </Animated.View>
  );
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
    scrolledTo.current = currentStopId;
    const offset = Math.max(0, y - size.height * 0.45);
    // Let the content lay out first (web measures after paint).
    const id = setTimeout(
      () => scroll.current?.scrollTo({ y: offset, animated: !first && !reduced }),
      0,
    );
    return () => clearTimeout(id);
  }, [active, size, layout, currentStopId, reduced]);

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
            <ZoneScenery key={zl.zoneId} zone={zl} width={width} index={index} />
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
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  croc: { position: 'absolute', left: 0, top: 0, width: CROC_W },
  ghost: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 2,
    borderColor: 'rgba(120,140,128,0.35)',
    borderStyle: 'dashed',
  },
});
