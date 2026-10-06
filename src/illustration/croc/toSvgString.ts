import { EYE_GRADIENT, GRADIENT_PREFIX, type CrocDrawing, type Shape } from './types';

function attrs(obj: Record<string, string | number | undefined>): string {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
}

/** Resolves a fill: plain colour, the eye gradient, or a named linear gradient. */
export function resolveFill(fill: string | undefined, gradientId: string): string | undefined {
  if (fill === EYE_GRADIENT) return `url(#${gradientId})`;
  if (fill?.startsWith(GRADIENT_PREFIX))
    return `url(#${gradientId}-${fill.slice(GRADIENT_PREFIX.length)})`;
  return fill;
}

function shapeToString(shape: Shape, gradientId: string): string {
  switch (shape.kind) {
    case 'path':
      return `<path ${attrs({
        d: shape.d,
        fill: resolveFill(shape.fill, gradientId) ?? 'none',
        stroke: shape.stroke,
        'stroke-width': shape.strokeWidth,
        'stroke-linecap': shape.stroke ? 'round' : undefined,
        'stroke-linejoin': shape.stroke ? 'round' : undefined,
        'stroke-dasharray': shape.dash,
        opacity: shape.opacity,
      })}/>`;
    case 'ellipse':
      return `<ellipse ${attrs({
        cx: shape.cx,
        cy: shape.cy,
        rx: shape.rx,
        ry: shape.ry,
        fill: resolveFill(shape.fill, gradientId) ?? 'none',
        stroke: shape.stroke,
        'stroke-width': shape.strokeWidth,
        opacity: shape.opacity,
      })}/>`;
    case 'group':
      return `<g ${attrs({ transform: shape.transform, opacity: shape.opacity })}>${shape.children
        .map((c) => shapeToString(c, gradientId))
        .join('')}</g>`;
  }
}

/**
 * Renders a drawing to a static SVG string. Used by tests and tooling; the app renders with
 * react-native-svg (see Croc.tsx) from the same shape list.
 */
export function drawingToSvgString(
  drawing: CrocDrawing,
  options: { width?: number; gradientId?: string; eyeStops?: [string, string, string] } = {},
): string {
  const { viewBox, shapes, eye, gradients = [] } = drawing;
  const id = options.gradientId ?? 'eye';
  const width = options.width ?? viewBox.w;
  const height = (width * viewBox.h) / viewBox.w;
  const [s0, s1, s2] = options.eyeStops ?? ['#FFD57A', '#F2A93B', '#B8701A'];
  const eyeGradient = eye
    ? `<radialGradient id="${id}" cx="${eye.cx}" cy="${eye.cy - eye.r * 0.15}" r="${eye.r * 1.1}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${s0}"/><stop offset="0.65" stop-color="${s1}"/><stop offset="1" stop-color="${s2}"/></radialGradient>`
    : '';
  const linear = gradients
    .map(
      (g) =>
        `<linearGradient id="${id}-${g.id}" x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}" gradientUnits="userSpaceOnUse">${g.stops
          .map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`)
          .join('')}</linearGradient>`,
    )
    .join('');
  const defs = eyeGradient || linear ? `<defs>${eyeGradient}${linear}</defs>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}">${defs}${shapes
    .map((s) => shapeToString(s, id))
    .join('')}</svg>`;
}
