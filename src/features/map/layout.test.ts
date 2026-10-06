import { localContent } from '@/content/repository';

import { LONG_TRANCE_SIZE, NODE_SIZE, layoutMap, nodeY } from './layout';

const input = localContent.zones().map((z) => ({
  zoneId: z.id,
  comingSoon: z.entry.kind === 'comingSoon',
  stops: localContent.stopsOf(z.id).map((s) => ({ id: s.id, type: s.type })),
}));

describe('layoutMap', () => {
  it.each([360, 390, 820])('keeps every node on screen at %ipx and stacks zones', (width) => {
    const layout = layoutMap(input, width);
    let top = 0;
    for (const zone of layout.zones) {
      expect(zone.top).toBe(top);
      top += zone.height;
      for (const node of zone.nodes) {
        expect(node.x - node.size / 2).toBeGreaterThanOrEqual(0);
        expect(node.x + node.size / 2).toBeLessThanOrEqual(width);
        expect(node.y).toBeGreaterThan(0);
        expect(node.y).toBeLessThan(zone.height);
      }
      // The river enters and leaves mid-width, so the zones join up.
      expect(zone.river[0]).toEqual({ x: width / 2, y: 0 });
      expect(zone.river[zone.river.length - 1]).toEqual({ x: width / 2, y: zone.height });
    }
    expect(layout.height).toBe(top);
  });

  it('nodes go down the river in order; the long trance is the big one', () => {
    const layout = layoutMap(input, 390);
    const intro = layout.zones[0]!;
    const ys = intro.nodes.map((n) => n.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    expect(intro.nodes.at(-1)!.size).toBe(LONG_TRANCE_SIZE);
    expect(intro.nodes[0]!.size).toBe(NODE_SIZE);
    expect(nodeY(layout, 'sleep-1')).toBe(layout.zones[1]!.top + layout.zones[1]!.nodes[0]!.y);
    expect(nodeY(layout, 'nope')).toBeNull();
    // Coming-soon zones get a few ghost nodes and no real stops.
    expect(layout.zones[2]!.comingSoon).toBe(true);
    expect(layout.zones[2]!.nodes.length).toBeGreaterThan(0);
  });
});
