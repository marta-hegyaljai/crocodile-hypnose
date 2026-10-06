import type { StopType, ZoneId } from '@/content/types';

/** Where a stop node sits, in map coordinates (top of the map is y = 0). */
export interface NodeLayout {
  stopId: string;
  x: number;
  y: number;
  size: number;
}

export interface ZoneLayout {
  zoneId: ZoneId;
  /** Top of the zone's region on the map, and its height. */
  top: number;
  height: number;
  comingSoon: boolean;
  /** Node centres relative to the zone's top. */
  nodes: NodeLayout[];
  /** Points the river flows through, relative to the zone's top (enters and leaves mid-width). */
  river: { x: number; y: number }[];
}

export interface MapLayout {
  width: number;
  height: number;
  /** 1 on phones; nodes, river and props grow with it on wide screens (tablets). */
  scale: number;
  zones: ZoneLayout[];
}

export interface LayoutZoneInput {
  zoneId: ZoneId;
  comingSoon: boolean;
  stops: { id: string; type: StopType }[];
}

export const NODE_SIZE = 64;
export const LONG_TRANCE_SIZE = 92;
const HEADER = 108;
const GAP = 112;
const LONG_GAP = 136;
const FOOT = 64;
const MIN_ZONE_HEIGHT = 240;
/** Ghost nodes drawn in a coming-soon zone (no content yet). */
export const GHOST_NODES = 3;

/**
 * Lays the river out: each zone is a band with its header sign on top and its stops winding
 * left and right of the middle. Pure (numbers only), so it is cheap to memoise and easy to test.
 */
/** Nodes and the river grow a little on wide screens, so a tablet map is not a phone map stretched. */
export function mapScale(width: number): number {
  return width >= 700 ? 1.3 : width >= 560 ? 1.15 : 1;
}

export function layoutMap(zones: LayoutZoneInput[], width: number): MapLayout {
  const mid = width / 2;
  const scale = mapScale(width);
  // How far the river swings: wide enough to feel like a winding river, never off-screen.
  const swing = Math.max(48, Math.min(width * 0.27, 150 * scale));
  const gap = Math.round(GAP * scale);
  const longGap = Math.round(LONG_GAP * scale);
  let top = 0;
  let phase = 0;
  const out: ZoneLayout[] = [];
  for (const zone of zones) {
    const nodes: NodeLayout[] = [];
    const river: { x: number; y: number }[] = [{ x: mid, y: 0 }];
    let y = HEADER + 36;
    const items = zone.comingSoon
      ? Array.from({ length: GHOST_NODES }, (_, i) => ({
          id: `${zone.zoneId}-ghost-${i}`,
          type: 'audio' as StopType,
        }))
      : zone.stops;
    items.forEach((stop, i) => {
      const long = stop.type === 'longTrance';
      const size = Math.round((long ? LONG_TRANCE_SIZE : NODE_SIZE) * scale);
      // The finale sits in the middle of the river; the others swing side to side.
      const x = long ? mid : mid + swing * Math.sin(phase + i * 1.15 + 0.6);
      if (i > 0) y += long ? longGap : zone.comingSoon ? Math.round(70 * scale) : gap;
      nodes.push({ stopId: stop.id, x: Math.round(x), y: Math.round(y), size });
      river.push({ x: Math.round(x), y: Math.round(y) });
    });
    const height = Math.max(MIN_ZONE_HEIGHT, y + FOOT + (zone.comingSoon ? 0 : 40));
    river.push({ x: mid, y: height });
    out.push({ zoneId: zone.zoneId, top, height, comingSoon: zone.comingSoon, nodes, river });
    top += height;
    phase += 1.7;
  }
  return { width, height: top, scale, zones: out };
}

/** The map y of a stop's node centre, or null when it is not on the map. */
export function nodeY(layout: MapLayout, stopId: string): number | null {
  for (const zone of layout.zones) {
    const node = zone.nodes.find((n) => n.stopId === stopId);
    if (node) return zone.top + node.y;
  }
  return null;
}
