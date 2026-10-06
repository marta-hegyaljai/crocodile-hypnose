import { crocColors } from './colors';
import { buildCroc, peekWaterlineRatio } from './geometry';
import { drawingToSvgString } from './toSvgString';
import { CROC_EXPRESSIONS, CROC_STAGES, EYE_GRADIENT, type Shape } from './types';

const colors = crocColors('daylight');

function flatten(shapes: Shape[]): Shape[] {
  return shapes.flatMap((s) => (s.kind === 'group' ? [s, ...flatten(s.children)] : [s]));
}

describe('buildCroc', () => {
  const combos = CROC_STAGES.flatMap((stage) =>
    CROC_EXPRESSIONS.flatMap((expression) =>
      (['full', 'peek'] as const).map((pose) => ({ stage, expression, pose })),
    ),
  );

  it.each(combos)(
    '$stage / $expression / $pose builds finite geometry',
    ({ stage, expression, pose }) => {
      const drawing = buildCroc({ stage, expression, pose, colors });
      expect(drawing.viewBox.w).toBeGreaterThan(0);
      expect(drawing.viewBox.h).toBeGreaterThan(0);
      const all = flatten(drawing.shapes);
      expect(all.length).toBeGreaterThan(5);
      const svg = drawingToSvgString(drawing);
      expect(svg).not.toMatch(/NaN|undefined|Infinity/);
      for (const shape of all) {
        if (shape.kind === 'ellipse') {
          expect(shape.rx).toBeGreaterThan(0);
          expect(shape.ry).toBeGreaterThan(0);
        }
      }
    },
  );

  it('is deterministic', () => {
    const a = drawingToSvgString(
      buildCroc({ stage: 'adult', expression: 'happy', pose: 'full', colors }),
    );
    const b = drawingToSvgString(
      buildCroc({ stage: 'adult', expression: 'happy', pose: 'full', colors }),
    );
    expect(a).toBe(b);
  });

  it('shows the amber eye in every hatched stage and closes it for eyesClosed', () => {
    for (const stage of ['hatchling', 'juvenile', 'adult', 'grand'] as const) {
      const open = flatten(buildCroc({ stage, expression: 'calm', pose: 'full', colors }).shapes);
      expect(open.some((s) => s.kind === 'ellipse' && s.fill === EYE_GRADIENT)).toBe(true);
      const closed = flatten(
        buildCroc({ stage, expression: 'eyesClosed', pose: 'full', colors }).shapes,
      );
      expect(closed.some((s) => s.kind === 'ellipse' && s.fill === EYE_GRADIENT)).toBe(false);
    }
  });

  it('blink factor 0 closes the eye even on an open expression', () => {
    const shapes = flatten(
      buildCroc({ stage: 'adult', expression: 'excited', pose: 'full', colors, blink: 0 }).shapes,
    );
    expect(shapes.some((s) => s.kind === 'ellipse' && s.fill === EYE_GRADIENT)).toBe(false);
  });

  it('places the peek waterline inside the frame', () => {
    for (const stage of ['hatchling', 'juvenile', 'adult', 'grand'] as const) {
      const d = buildCroc({ stage, expression: 'calm', pose: 'peek', colors });
      const ratio = peekWaterlineRatio(d);
      expect(ratio).toBeGreaterThan(0.4);
      expect(ratio).toBeLessThan(0.8);
    }
    expect(
      peekWaterlineRatio(buildCroc({ stage: 'egg', expression: 'calm', pose: 'full', colors })),
    ).toBe(0.6);
  });

  it('scales stages relative to each other in the full pose', () => {
    const grand = buildCroc({ stage: 'grand', expression: 'calm', pose: 'full', colors });
    const hatchling = buildCroc({ stage: 'hatchling', expression: 'calm', pose: 'full', colors });
    const same = buildCroc({
      stage: 'hatchling',
      expression: 'calm',
      pose: 'full',
      colors,
      relativeSize: false,
    });
    expect(grand.shapes[0]?.kind === 'group' && grand.shapes[0].transform).toBeFalsy();
    expect(hatchling.shapes[0]?.kind === 'group' && hatchling.shapes[0].transform).toMatch(
      /scale\(0\.6\)/,
    );
    expect(same.shapes[0]?.kind === 'group' && same.shapes[0].transform).toBeFalsy();
  });

  it('renders a unique gradient id into the svg string', () => {
    const svg = drawingToSvgString(
      buildCroc({ stage: 'adult', expression: 'calm', pose: 'full', colors }),
      {
        gradientId: 'g42',
      },
    );
    expect(svg).toContain('id="g42"');
    expect(svg).toContain('url(#g42)');
  });
});
