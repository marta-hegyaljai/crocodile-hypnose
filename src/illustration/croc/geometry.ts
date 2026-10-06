import { FACE_SPECS, STAGE_SPECS, type FaceSpec, type StageSpec } from './specs';
import {
  EYE_GRADIENT,
  gradientFill,
  type CrocColors,
  type CrocDrawing,
  type CrocExpression,
  type CrocPose,
  type CrocStage,
  type LinearGradientDef,
  type Point,
  type Shape,
  type ViewBox,
} from './types';

/** Full-body canvas in figure units. */
export const FIGURE_W = 384;
export const FIGURE_H = 170;
export const GROUND_Y = 148;
/** The full-body canvas starts here: everything above is empty for every stage and expression. */
export const FIGURE_TOP = 40;

/** Gradient ids used by the fills (declared per drawing in user space). */
const SKIN = gradientFill('skin');
const SHELL = gradientFill('shell');

export interface BuildOptions {
  stage: CrocStage;
  expression: CrocExpression;
  pose: CrocPose;
  colors: CrocColors;
  /** Multiplies the expression's eye opening (1 = as designed, 0 = closed). Used for blinking. */
  blink?: number;
  /** Full pose only: scale stages relative to each other (hatchling small, grand big). */
  relativeSize?: boolean;
  /** Full pose only: soft shadow on the ground. */
  groundShadow?: boolean;
}

const n = (v: number) => (Math.round(v * 100) / 100).toString();
const pt = (p: Point) => `${n(p.x)} ${n(p.y)}`;
const P = (x: number, y: number): Point => ({ x, y });

/** Cubic bezier helpers for placing details along curves. */
function cubicAt(p0: Point, c1: Point, c2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt ** 3 * p0.x + 3 * mt ** 2 * t * c1.x + 3 * mt * t ** 2 * c2.x + t ** 3 * p3.x,
    y: mt ** 3 * p0.y + 3 * mt ** 2 * t * c1.y + 3 * mt * t ** 2 * c2.y + t ** 3 * p3.y,
  };
}

/** Tangent angle (degrees) of a cubic at t, for leaning details along the curve. */
function cubicAngle(p0: Point, c1: Point, c2: Point, p3: Point, t: number): number {
  const mt = 1 - t;
  const dx = 3 * mt * mt * (c1.x - p0.x) + 6 * mt * t * (c2.x - c1.x) + 3 * t * t * (p3.x - c2.x);
  const dy = 3 * mt * mt * (c1.y - p0.y) + 6 * mt * t * (c2.y - c1.y) + 3 * t * t * (p3.y - c2.y);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

function rotate(p: Point, origin: Point, deg: number): Point {
  const a = (deg * Math.PI) / 180;
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return {
    x: origin.x + dx * Math.cos(a) - dy * Math.sin(a),
    y: origin.y + dx * Math.sin(a) + dy * Math.cos(a),
  };
}

const cubic = (c1: Point, c2: Point, p: Point) => `C ${pt(c1)} ${pt(c2)} ${pt(p)}`;

function sparkle(cx: number, cy: number, r: number, fill: string, opacity = 1): Shape {
  const k = r * 0.22;
  return {
    kind: 'path',
    d: `M ${n(cx)} ${n(cy - r)} C ${n(cx + k)} ${n(cy - k)} ${n(cx + k)} ${n(cy - k)} ${n(cx + r)} ${n(cy)} C ${n(cx + k)} ${n(cy + k)} ${n(cx + k)} ${n(cy + k)} ${n(cx)} ${n(cy + r)} C ${n(cx - k)} ${n(cy + k)} ${n(cx - k)} ${n(cy + k)} ${n(cx - r)} ${n(cy)} C ${n(cx - k)} ${n(cy - k)} ${n(cx - k)} ${n(cy - k)} ${n(cx)} ${n(cy - r)} Z`,
    fill,
    opacity,
  };
}

/** A soft ridge scute: a low half-ellipse dome leaning with the back it sits on; the base sinks into the skin. */
function scute(x: number, y: number, s: number, fill: string, angle = 0): Shape {
  const base = s * 1.15;
  const h = s * 1.05;
  const body: Shape = {
    kind: 'path',
    d: `M ${n(x - base)} ${n(y + 1.6)} A ${n(base)} ${n(h)} 0 0 1 ${n(x + base)} ${n(y + 1.6)} Z`,
    fill,
  };
  if (!angle) return body;
  return { kind: 'group', transform: `rotate(${n(angle)} ${n(x)} ${n(y)})`, children: [body] };
}

interface HeadGeometry {
  hx: number;
  hy: number;
  spec: StageSpec;
  face: FaceSpec;
  colors: CrocColors;
  eyeOpen: number;
}

/** Mouth line from the corner K to the tip Q as cubic control points (shared by jaws, teeth and stroke). */
function mouthCurve(g: HeadGeometry) {
  const { hx, hy, spec, face } = g;
  const { headR, snoutLen, snoutTipR } = spec;
  const K = P(hx - headR * 0.02, hy + headR * 0.32 - face.smile * headR * 0.22);
  const Q = P(hx + snoutLen - 0.5, hy + snoutTipR * 0.22);
  const c1 = P(hx + headR * 0.55, hy + headR * 0.44);
  const c2 = P(hx + snoutLen * 0.62, hy + snoutTipR * 0.42);
  return { K, Q, c1, c2 };
}

function buildHead(g: HeadGeometry): {
  shapes: Shape[];
  eye: { cx: number; cy: number; r: number };
} {
  const { hx, hy, spec, face, colors, eyeOpen } = g;
  const { headR, snoutLen, snoutTipR, snoutDip, eyeR, socketR } = spec;
  const shapes: Shape[] = [];
  const { K, Q, c1, c2 } = mouthCurve(g);

  // Upper head and snout (bottom edge is the mouth line). The back of the head is a full round cheek.
  const S = P(hx - headR, hy + headR * 0.25);
  const T = P(hx + headR * 0.08, hy - headR);
  const E = P(hx + headR * 0.78, hy - headR * 0.72);
  const M = P(hx + snoutLen * 0.56, hy - snoutTipR * 1.12 - snoutDip);
  const N = P(hx + snoutLen - snoutTipR * 0.95, hy - snoutTipR * 1.3);
  const Ptip = P(hx + snoutLen + 0.5, hy - snoutTipR * 0.55);
  const upper = [
    `M ${pt(S)}`,
    cubic(P(hx - headR, hy - headR * 0.52), P(hx - headR * 0.52, hy - headR), T),
    cubic(P(hx + headR * 0.46, hy - headR), P(hx + headR * 0.66, hy - headR * 0.9), E),
    cubic(
      P(hx + headR * 0.98, hy - headR * 0.5),
      P(hx + snoutLen * 0.33, hy - snoutTipR * 1.1 - snoutDip),
      M,
    ),
    cubic(
      P(hx + snoutLen * 0.76, hy - snoutTipR * 1.2 - snoutDip),
      P(hx + snoutLen - snoutTipR * 1.35, hy - snoutTipR * 1.4),
      N,
    ),
    cubic(
      P(hx + snoutLen - snoutTipR * 0.25, hy - snoutTipR * 1.25),
      P(hx + snoutLen + 1, hy - snoutTipR * 0.95),
      Ptip,
    ),
    cubic(
      P(hx + snoutLen + 1, hy - snoutTipR * 0.1),
      P(hx + snoutLen + 0.3, hy + snoutTipR * 0.22),
      Q,
    ),
    cubic(c2, c1, K),
    cubic(P(hx - headR * 0.5, hy + headR * 0.6), P(hx - headR * 0.92, hy + headR * 0.62), S),
    'Z',
  ].join(' ');

  // Lower jaw, rotated around the mouth corner when the mouth opens.
  const jawTip = P(hx + snoutLen - 3, hy + snoutTipR * 0.22);
  const chin1 = P(hx + snoutLen - snoutTipR * 1.5, hy + snoutTipR * 1.35);
  const jaw = [
    `M ${pt(K)}`,
    cubic(c1, c2, jawTip),
    cubic(
      P(hx + snoutLen - 1.5, hy + snoutTipR * 0.95),
      P(hx + snoutLen - snoutTipR * 0.7, hy + snoutTipR * 1.35),
      chin1,
    ),
    cubic(
      P(hx + snoutLen * 0.5, hy + snoutTipR * 1.45 + 1),
      P(hx + headR * 0.62, hy + headR * 0.98),
      P(hx - headR * 0.08, hy + headR * 1.0),
    ),
    cubic(
      P(hx - headR * 0.7, hy + headR * 0.98),
      P(hx - headR * 0.98, hy + headR * 0.72),
      P(hx - headR * 0.92, hy + headR * 0.3),
    ),
    `L ${pt(K)} Z`,
  ].join(' ');
  // Lighter throat / chin band on the lower jaw.
  const chinBand = [
    `M ${pt(P(hx + snoutLen - snoutTipR * 1.2, hy + snoutTipR * 1.1))}`,
    cubic(
      P(hx + snoutLen * 0.5, hy + snoutTipR * 1.2),
      P(hx + headR * 0.6, hy + headR * 0.72),
      P(hx - headR * 0.3, hy + headR * 0.7),
    ),
    cubic(
      P(hx - headR * 0.6, hy + headR * 0.72),
      P(hx - headR * 0.8, hy + headR * 0.86),
      P(hx - headR * 0.75, hy + headR * 0.98),
    ),
    cubic(
      P(hx - headR * 0.4, hy + headR * 1.0),
      P(hx + snoutLen * 0.4, hy + snoutTipR * 1.5),
      P(hx + snoutLen - snoutTipR * 1.45, hy + snoutTipR * 1.34),
    ),
    'Z',
  ].join(' ');

  // Mouth interior shows when the jaw drops: wedge between the upper mouth line and the rotated jaw line.
  if (face.jawOpen > 0) {
    const rQ = rotate(jawTip, K, face.jawOpen);
    const rc1 = rotate(c1, K, face.jawOpen);
    const rc2 = rotate(c2, K, face.jawOpen);
    shapes.push({
      kind: 'path',
      d: `M ${pt(K)} ${cubic(c1, c2, Q)} L ${pt(rQ)} ${cubic(rc2, rc1, K)} Z`,
      fill: colors.mouth,
    });
    if (face.tongue) {
      const tx = hx + headR * 0.9;
      const ty = (K.y + rotate(P(tx, c1.y), K, face.jawOpen).y) / 2 + 2;
      shapes.push({
        kind: 'ellipse',
        cx: tx,
        cy: ty,
        rx: headR * 0.26,
        ry: headR * 0.11,
        fill: colors.tongue,
      });
    }
  }

  const jawGroup: Shape = {
    kind: 'group',
    transform: face.jawOpen > 0 ? `rotate(${n(face.jawOpen)} ${pt(K)})` : undefined,
    children: [
      { kind: 'path', d: jaw, fill: SKIN },
      { kind: 'path', d: chinBand, fill: colors.belly, opacity: 0.9 },
    ],
  };
  shapes.push(jawGroup);
  shapes.push({ kind: 'path', d: upper, fill: SKIN });

  // Lit top of the snout.
  shapes.push({
    kind: 'path',
    d: `M ${pt(P(hx + headR * 0.95, hy - headR * 0.42))} ${cubic(P(hx + snoutLen * 0.4, hy - snoutTipR * 0.95 - snoutDip), P(hx + snoutLen * 0.8, hy - snoutTipR * 1.05), P(hx + snoutLen - snoutTipR * 0.6, hy - snoutTipR * 0.9))} ${cubic(P(hx + snoutLen * 0.75, hy - snoutTipR * 0.6), P(hx + snoutLen * 0.4, hy - snoutTipR * 0.5), P(hx + headR * 0.95, hy - headR * 0.25))} Z`,
    fill: colors.skinLight,
    opacity: 0.5,
  });

  // Scale bumps along the top of the snout (tiny, friendly).
  for (let i = 0; i < 3; i++) {
    const f = 0.28 + i * 0.2;
    shapes.push({
      kind: 'ellipse',
      cx: hx + headR * 0.9 + snoutLen * f * 0.78,
      cy: hy - snoutTipR * 1.02 - snoutDip * (1 - f) + i * 0.4,
      rx: 1.6,
      ry: 1.1,
      fill: colors.scute,
      opacity: 0.35,
    });
  }

  // Mouth line and the smile curl at the corner.
  shapes.push({
    kind: 'path',
    d: `M ${pt(Q)} ${cubic(c2, c1, K)}`,
    stroke: colors.scute,
    strokeWidth: 2.1,
    fill: 'none',
  });
  if (face.yawn) {
    const m = cubicAt(K, c1, c2, Q, 0.3);
    shapes.push({
      kind: 'ellipse',
      cx: m.x,
      cy: m.y + 0.5,
      rx: headR * 0.09,
      ry: headR * 0.075,
      fill: colors.mouth,
    });
  }
  const curl = 2 + face.smile * 5 + (face.lidAngle > 0 ? 2.5 : 0);
  shapes.push({
    kind: 'path',
    d: `M ${pt(K)} q ${n(-curl * 0.5)} ${n(-curl * 0.25)} ${n(-curl * 0.9)} ${n(-curl)}`,
    stroke: colors.scute,
    strokeWidth: 2.1,
    fill: 'none',
  });

  // Teeth: tiny, friendly, hanging from the upper jaw.
  for (let i = 0; i < spec.teeth; i++) {
    const t = 0.3 + (i / Math.max(1, spec.teeth - 1)) * 0.45;
    const p = cubicAt(K, c1, c2, Q, t);
    const w = 2.1;
    shapes.push({
      kind: 'path',
      d: `M ${n(p.x - w)} ${n(p.y - 0.4)} Q ${n(p.x)} ${n(p.y + 4.6)} ${n(p.x + w)} ${n(p.y - 0.4)} Z`,
      fill: colors.teeth,
    });
  }

  // Nostril.
  shapes.push({
    kind: 'ellipse',
    cx: hx + snoutLen - snoutTipR * 0.72,
    cy: hy - snoutTipR * 0.82,
    rx: snoutTipR * 0.16,
    ry: snoutTipR * 0.11,
    fill: colors.scute,
    opacity: 0.85,
  });

  // Cheek blush.
  if (face.blush) {
    shapes.push({
      kind: 'ellipse',
      cx: hx + headR * 0.6,
      cy: hy + headR * 0.0,
      rx: headR * 0.17,
      ry: headR * 0.1,
      fill: colors.blush,
      opacity: 0.85,
    });
  }

  // Eye socket bump, eye, pupil, highlight, lid.
  const sx = hx + headR * 0.3;
  const sy = hy - headR * 0.8;
  const ex = sx;
  const ey = sy + socketR * 0.08;
  shapes.push({
    kind: 'ellipse',
    cx: sx,
    cy: sy,
    rx: socketR * 1.12,
    ry: socketR,
    fill: colors.skinLight,
  });
  if (spec.browRidge) {
    // The grand croc's heavy, wise brow: a darker ridge over the socket.
    shapes.push({
      kind: 'path',
      d: `M ${n(sx - socketR * 1.05)} ${n(sy - socketR * 0.3)} C ${n(sx - socketR * 0.7)} ${n(sy - socketR * 1.25)} ${n(sx + socketR * 0.5)} ${n(sy - socketR * 1.3)} ${n(sx + socketR * 1.1)} ${n(sy - socketR * 0.45)} C ${n(sx + socketR * 0.55)} ${n(sy - socketR * 0.95)} ${n(sx - socketR * 0.55)} ${n(sy - socketR * 0.9)} ${n(sx - socketR * 1.05)} ${n(sy - socketR * 0.3)} Z`,
      fill: colors.scute,
      opacity: 0.75,
    });
  }

  const open = Math.max(0, Math.min(1, eyeOpen));
  if (open > 0.04) {
    // A dark ring around the amber eye gives it depth; the slit pupil is the signature.
    shapes.push({
      kind: 'ellipse',
      cx: ex,
      cy: ey,
      rx: eyeR,
      ry: eyeR,
      fill: EYE_GRADIENT,
      stroke: colors.scute,
      strokeWidth: 1.2,
    });
    const px = ex + face.lookAhead * eyeR * 0.28;
    shapes.push({
      kind: 'ellipse',
      cx: px,
      cy: ey,
      rx: eyeR * 0.17 * face.pupilScale,
      ry: eyeR * 0.74 * face.pupilScale,
      fill: colors.pupil,
    });
    shapes.push({
      kind: 'ellipse',
      cx: ex + eyeR * 0.4,
      cy: ey - eyeR * 0.42,
      rx: eyeR * 0.21,
      ry: eyeR * 0.21,
      fill: colors.highlight,
      opacity: 0.95,
    });
    shapes.push({
      kind: 'ellipse',
      cx: ex - eyeR * 0.38,
      cy: ey + eyeR * 0.42,
      rx: eyeR * 0.1,
      ry: eyeR * 0.1,
      fill: colors.highlight,
      opacity: 0.6,
    });

    // Upper eyelid: circular segment above the lid line.
    if (open < 0.98) {
      const lidY = ey - eyeR + 2 * eyeR * (1 - open);
      const dy = lidY - ey;
      const dx = Math.sqrt(Math.max(0, eyeR * eyeR - dy * dy));
      const r = eyeR + 0.6;
      const large = lidY > ey ? 1 : 0;
      const lid: Shape[] = [
        {
          kind: 'path',
          d: `M ${n(ex - dx)} ${n(lidY)} A ${n(r)} ${n(r)} 0 ${large} 1 ${n(ex + dx)} ${n(lidY)} Q ${n(ex)} ${n(lidY + 1.6)} ${n(ex - dx)} ${n(lidY)} Z`,
          fill: colors.skinLight,
        },
        {
          kind: 'path',
          d: `M ${n(ex - dx)} ${n(lidY)} Q ${n(ex)} ${n(lidY + 1.6)} ${n(ex + dx)} ${n(lidY)}`,
          stroke: colors.scute,
          strokeWidth: 1.4,
          fill: 'none',
          opacity: 0.85,
        },
      ];
      shapes.push({
        kind: 'group',
        transform: face.lidAngle ? `rotate(${n(face.lidAngle)} ${n(ex)} ${n(ey)})` : undefined,
        children: lid,
      });
    }
  }
  if (face.brow > 0) {
    // Raised brow: an arc that hugs the top of the socket and lifts with surprise.
    const lift = socketR * 0.14 * face.brow;
    shapes.push({
      kind: 'path',
      d: `M ${n(sx - socketR * 0.9)} ${n(sy - socketR * 0.55 - lift)} Q ${n(sx + socketR * 0.05)} ${n(sy - socketR * 1.35 - lift)} ${n(sx + socketR * 0.95)} ${n(sy - socketR * 0.7 - lift)}`,
      stroke: colors.scute,
      strokeWidth: 2.2,
      fill: 'none',
      opacity: 0.85,
    });
  }
  if (open <= 0.04) {
    // Closed: a soft, content curve.
    shapes.push({
      kind: 'path',
      d: `M ${n(ex - eyeR * 0.85)} ${n(ey - eyeR * 0.15)} Q ${n(ex)} ${n(ey + eyeR * 0.55)} ${n(ex + eyeR * 0.85)} ${n(ey - eyeR * 0.15)}`,
      stroke: colors.scute,
      strokeWidth: 2.2,
      fill: 'none',
    });
  }

  // Stage decorations on the head.
  if (spec.shellCap) {
    const capL = P(hx - headR * 0.52, hy - headR * 0.82);
    const capR = P(hx + headR * 0.52 - socketR * 0.5, hy - headR * 0.92);
    const zig: string[] = [];
    const steps = 5;
    for (let i = 1; i <= steps; i++) {
      const x = capR.x + ((capL.x - capR.x) * i) / steps;
      const y = capR.y + ((capL.y - capR.y) * i) / steps + (i % 2 === 1 ? 3.2 : -1.2);
      zig.push(`L ${n(x)} ${n(y)}`);
    }
    shapes.push({
      kind: 'path',
      d: `M ${pt(capL)} Q ${n(hx - headR * 0.15)} ${n(hy - headR * 1.75)} ${pt(capR)} ${zig.join(' ')} Z`,
      fill: colors.shell,
      stroke: colors.shellSpeckle,
      strokeWidth: 0.8,
    });
    shapes.push({
      kind: 'ellipse',
      cx: hx - headR * 0.3,
      cy: hy - headR * 1.25,
      rx: 1.8,
      ry: 1.3,
      fill: colors.shellSpeckle,
      opacity: 0.55,
    });
    shapes.push({
      kind: 'ellipse',
      cx: hx - headR * 0.02,
      cy: hy - headR * 1.42,
      rx: 1.4,
      ry: 1.1,
      fill: colors.shellSpeckle,
      opacity: 0.55,
    });
  }
  if (spec.lily) {
    const lx = hx - headR * 0.4;
    const ly = hy - headR * 1.08;
    const r = headR * 0.3;
    const petals: Shape[] = [];
    for (let i = 0; i < 5; i++) {
      const a = -90 + i * 36 - 72;
      petals.push({
        kind: 'group',
        transform: `rotate(${a} ${n(lx)} ${n(ly)})`,
        children: [
          {
            kind: 'ellipse',
            cx: lx,
            cy: ly - r * 0.55,
            rx: r * 0.3,
            ry: r * 0.62,
            fill: colors.lily,
          },
        ],
      });
    }
    shapes.push({ kind: 'group', children: petals });
    shapes.push({
      kind: 'ellipse',
      cx: lx,
      cy: ly - r * 0.12,
      rx: r * 0.26,
      ry: r * 0.2,
      fill: colors.lilyCenter,
    });
  }

  return { shapes, eye: { cx: ex, cy: ey, r: eyeR } };
}

/** Full pose: body, tail, legs, belly, spots, scutes. */
function buildBodyAndTail(hx: number, hy: number, spec: StageSpec, colors: CrocColors): Shape[] {
  const { headR, tailLen, legW, legH, bodyLen } = spec;
  const shapes: Shape[] = [];

  // Back top curve (used for the body outline and scute placement).
  const b0 = P(hx - headR * 0.55, hy - headR * 0.74);
  const b1 = P(hx - bodyLen * 0.3, hy - headR * 1.08);
  const b2 = P(hx - bodyLen * 0.78, hy - headR * 0.98);
  const b3 = P(hx - bodyLen, hy - headR * 0.22);
  const bottomL = P(hx - bodyLen + 5, hy + headR * 0.62);
  const bottomR = P(hx - headR * 0.3, hy + headR * 0.86);
  const body = [
    `M ${pt(b0)}`,
    cubic(b1, b2, b3),
    `L ${pt(bottomL)}`,
    cubic(
      P(hx - bodyLen * 0.68, hy + headR * 1.02),
      P(hx - bodyLen * 0.3, hy + headR * 1.04),
      bottomR,
    ),
    'Z',
  ].join(' ');

  // Tail: dips then curls up at the tip.
  const t0 = b3;
  const t1 = P(hx - bodyLen - tailLen * 0.42, hy - headR * 0.12);
  const t2 = P(hx - bodyLen - tailLen * 0.84, hy + headR * 0.1);
  const tip = P(hx - bodyLen - tailLen, hy - headR * 0.62);
  const tail = [
    `M ${pt(t0)}`,
    cubic(t1, t2, tip),
    cubic(
      P(hx - bodyLen - tailLen * 0.78, hy + headR * 0.58),
      P(hx - bodyLen - tailLen * 0.4, hy + headR * 0.74),
      bottomL,
    ),
    'Z',
  ].join(' ');

  const legTop = hy + headR * 0.55;
  // Far legs (behind the body), set back and a touch darker.
  for (const x of [hx - headR * 0.85 - legW * 0.75, hx - bodyLen + legW * 1.6]) {
    shapes.push(
      leg(x, legTop, legW * 0.9, legH, GROUND_Y - 1.5, colors.skinShade, colors.skinDark),
    );
  }

  shapes.push({ kind: 'path', d: tail, fill: SKIN, stroke: colors.skin, strokeWidth: 1.5 });
  shapes.push({ kind: 'path', d: body, fill: SKIN });

  // Belly: a soft lens under the body that thins into the tail, so it reads as a round tummy.
  const bellyFront = P(hx - headR * 0.3, hy + headR * 0.86);
  const belly = [
    `M ${pt(bellyFront)}`,
    cubic(
      P(hx - headR * 0.45, hy + headR * 0.42),
      P(hx - bodyLen * 0.3, hy + headR * 0.28),
      P(hx - bodyLen * 0.52, hy + headR * 0.3),
    ),
    cubic(
      P(hx - bodyLen * 0.78, hy + headR * 0.32),
      P(hx - bodyLen * 0.95, hy + headR * 0.45),
      P(hx - bodyLen, hy + headR * 0.52),
    ),
    cubic(
      P(hx - bodyLen - tailLen * 0.3, hy + headR * 0.48),
      P(hx - bodyLen - tailLen * 0.6, hy + headR * 0.34),
      P(hx - bodyLen - tailLen * 0.78, hy + headR * 0.2),
    ),
    cubic(
      P(hx - bodyLen - tailLen * 0.62, hy + headR * 0.58),
      P(hx - bodyLen - tailLen * 0.3, hy + headR * 0.76),
      bottomL,
    ),
    cubic(
      P(hx - bodyLen * 0.68, hy + headR * 1.02),
      P(hx - bodyLen * 0.3, hy + headR * 1.04),
      bellyFront,
    ),
    'Z',
  ].join(' ');
  shapes.push({ kind: 'path', d: belly, fill: colors.belly, opacity: 0.95 });
  // A few soft belly creases following the curve of the tummy.
  const creases = Math.max(2, Math.round(bodyLen / 30));
  for (let i = 1; i <= creases; i++) {
    const x = hx - headR * 0.5 - (i * (bodyLen - headR * 0.9)) / (creases + 1);
    shapes.push({
      kind: 'path',
      d: `M ${n(x)} ${n(hy + headR * 0.5)} Q ${n(x - 2)} ${n(hy + headR * 0.78)} ${n(x + 0.5)} ${n(hy + headR * 0.98)}`,
      stroke: colors.skin,
      strokeWidth: 1,
      fill: 'none',
      opacity: 0.3,
    });
  }

  // Spots on the flank.
  for (let i = 0; i < spec.spots; i++) {
    const f = (i + 1) / (spec.spots + 1);
    const x = hx - headR * 0.6 - f * (bodyLen - headR * 0.9);
    const y = hy - headR * 0.3 + (i % 2) * headR * 0.28;
    shapes.push({
      kind: 'ellipse',
      cx: x,
      cy: y,
      rx: 4.2 - (i % 2) * 1.2,
      ry: 3 - (i % 2) * 0.8,
      fill: colors.scute,
      opacity: 0.28,
    });
  }
  // Darker bands on the tail (adult and grand).
  for (let i = 0; i < spec.tailBands; i++) {
    const t = 0.3 + (i / Math.max(1, spec.tailBands)) * 0.45;
    const p = cubicAt(t0, t1, t2, tip, t);
    shapes.push({
      kind: 'ellipse',
      cx: p.x,
      cy: p.y + headR * 0.3,
      rx: 3,
      ry: headR * 0.22 * (1 - t * 0.5),
      fill: colors.scute,
      opacity: 0.18,
    });
  }

  // Moss patches (grand).
  if (spec.moss) {
    for (const f of [0.3, 0.62]) {
      const p = cubicAt(b0, b1, b2, b3, f);
      shapes.push({
        kind: 'ellipse',
        cx: p.x,
        cy: p.y + 3.5,
        rx: 9,
        ry: 3.2,
        fill: colors.moss,
        opacity: 0.9,
      });
      shapes.push({ kind: 'ellipse', cx: p.x + 4, cy: p.y + 2.2, rx: 4, ry: 2, fill: colors.moss });
    }
  }

  // Scutes along the back and tail ridge, leaning with the curve.
  const s = Math.max(3.2, headR * 0.15);
  for (let i = 0; i < spec.scutes; i++) {
    const t = 0.06 + (i / Math.max(1, spec.scutes - 1)) * 0.82;
    const p = cubicAt(b0, b1, b2, b3, t);
    shapes.push(scute(p.x, p.y, s * (1 - t * 0.25), colors.scute, cubicAngle(b0, b1, b2, b3, t)));
  }
  for (let i = 0; i < spec.tailScutes; i++) {
    const t = 0.18 + (i / Math.max(1, spec.tailScutes)) * 0.6;
    const p = cubicAt(t0, t1, t2, tip, t);
    shapes.push(
      scute(p.x, p.y - 0.5, s * (0.75 - t * 0.35), colors.scute, cubicAngle(t0, t1, t2, tip, t)),
    );
  }

  // Near legs (in front of the body).
  for (const x of [hx - headR * 0.95, hx - bodyLen + legW * 0.95]) {
    shapes.push(leg(x, legTop, legW, legH, GROUND_Y, SKIN, colors.skinDark));
  }

  return shapes;
}

/**
 * Peek pose: the croc floats with the top of its back out of the water behind the head, a ridge of scutes
 * along it, and the tip of the tail curling up further back. Everything below the waterline is drawn too,
 * so a translucent water surface shows the submerged body softly.
 */
function buildPeekBody(
  hx: number,
  hy: number,
  spec: StageSpec,
  colors: CrocColors,
): { shapes: Shape[]; minX: number } {
  const { headR, bodyLen, tailLen } = spec;
  const shapes: Shape[] = [];
  const wl = hy + headR * 0.2;

  // Back hump: starts hidden inside the head, rises just above the surface, sinks again behind.
  const kb = Math.min(1, bodyLen / 92);
  const J = P(hx - headR * 0.55, hy + headR * 0.05);
  const c1 = P(hx - headR * 1.05, hy + headR * 0.05 - headR * 0.21 * kb);
  const endX = hx - headR * 0.6 - bodyLen * 0.8;
  const c2 = P(endX + bodyLen * 0.22, hy + headR * 0.05 - headR * 0.15 * kb);
  const E = P(endX, hy + headR * 0.4);
  const deep = hy + headR * 1.5;
  const hump = [
    `M ${pt(J)}`,
    cubic(c1, c2, E),
    cubic(
      P(endX - headR * 0.3, hy + headR * 0.85),
      P(endX - headR * 0.05, deep),
      P(endX + headR * 0.45, deep),
    ),
    `L ${pt(P(hx - headR * 0.1, deep))}`,
    cubic(P(hx + headR * 0.1, deep), P(hx - headR * 0.1, hy + headR * 0.6), J),
    'Z',
  ].join(' ');
  shapes.push({ kind: 'path', d: hump, fill: SKIN });
  for (let i = 0; i < Math.min(2, spec.spots); i++) {
    const p = cubicAt(J, c1, c2, E, 0.35 + i * 0.25);
    shapes.push({
      kind: 'ellipse',
      cx: p.x,
      cy: p.y + headR * 0.22,
      rx: 3.4,
      ry: 2.4,
      fill: colors.scute,
      opacity: 0.25,
    });
  }
  if (spec.moss) {
    const p = cubicAt(J, c1, c2, E, 0.55);
    shapes.push({ kind: 'ellipse', cx: p.x, cy: p.y + 2.5, rx: 8, ry: 3, fill: colors.moss });
  }
  // Ridge scutes, leaning with the hump and shrinking towards the water.
  const s = Math.max(2.8, headR * 0.12);
  const count = Math.max(4, Math.ceil(spec.scutes * 0.75));
  for (let i = 0; i < count; i++) {
    const t = 0.08 + (i / (count - 1)) * 0.74;
    const p = cubicAt(J, c1, c2, E, t);
    shapes.push(scute(p.x, p.y, s * (1 - t * 0.35), colors.scute, cubicAngle(J, c1, c2, E, t)));
  }

  // Tail tip: a slim crescent curling up out of the water further back, tapering to a round tip.
  const tx = endX - headR * 0.35 - tailLen * 0.3;
  const k = Math.min(1, tailLen / 76);
  const th = headR * 0.95 * k;
  const ta = P(tx + headR * 0.32 * k, wl + headR * 0.55);
  const tc1 = P(tx + headR * 0.36 * k, wl - th * 0.2);
  const tc2 = P(tx + headR * 0.08 * k, wl - th * 0.85);
  const tb = P(tx - headR * 0.36 * k, wl - th);
  const tailTip = [
    `M ${pt(ta)}`,
    cubic(tc1, tc2, tb),
    `Q ${pt(P(tx - headR * 0.52 * k, wl - th * 1.0))} ${pt(P(tx - headR * 0.55 * k, wl - th * 0.84))}`,
    cubic(
      P(tx - headR * 0.42 * k, wl - th * 0.5),
      P(tx - headR * 0.3 * k, wl - th * 0.1),
      P(tx - headR * 0.28 * k, wl + headR * 0.55),
    ),
    'Z',
  ].join(' ');
  shapes.push({ kind: 'path', d: tailTip, fill: SKIN });
  for (const t of [0.32, 0.6]) {
    const p = cubicAt(ta, tc1, tc2, tb, t);
    shapes.push(
      scute(p.x, p.y, s * (0.65 - t * 0.3), colors.scute, cubicAngle(ta, tc1, tc2, tb, t) + 180),
    );
  }

  return { shapes, minX: tx - headR * 0.7 };
}

/** A short, sprawled croc leg: a chunky rounded thigh that bends forward into a wide foot with toes. */
function leg(
  x: number,
  top: number,
  w: number,
  h: number,
  ground: number,
  fill: string,
  toe: string,
): Shape {
  const r = w / 2;
  const footRy = Math.max(3.5, h * 0.3);
  const footCy = ground - footRy;
  const footCx = x + w * 0.35;
  const footRx = w * 0.85;
  const thigh = [
    `M ${n(x - r)} ${n(top)}`,
    `C ${n(x - r - 1.5)} ${n(top + h * 0.7)} ${n(x - r * 0.6)} ${n(footCy)} ${n(x + r * 0.2)} ${n(footCy)}`,
    `L ${n(x + r * 0.9)} ${n(footCy)}`,
    `C ${n(x + r * 1.15)} ${n(top + h * 0.6)} ${n(x + r * 1.05)} ${n(top + h * 0.2)} ${n(x + r)} ${n(top)} Z`,
  ].join(' ');
  const toes: Shape[] = [0.55, 0.78, 0.98].map((f, i) => ({
    kind: 'ellipse',
    cx: footCx + footRx * (f - 0.45),
    cy: footCy + footRy * (0.35 - i * 0.12),
    rx: w * 0.1,
    ry: footRy * 0.5,
    fill: toe,
    opacity: 0.35,
  }));
  return {
    kind: 'group',
    children: [
      { kind: 'path', d: thigh, fill },
      { kind: 'ellipse', cx: footCx, cy: footCy, rx: footRx, ry: footRy, fill },
      ...toes,
    ],
  };
}

function buildEgg(
  face: FaceSpec,
  expression: CrocExpression,
  colors: CrocColors,
  pose: CrocPose,
): CrocDrawing {
  const W = 58;
  const H = 72;
  const cx = FIGURE_W / 2;
  const cy = GROUND_Y - H / 2 + 2;
  const top = cy - H / 2;
  const shapes: Shape[] = [];

  // Nest: mud mound and a few leaves/reeds.
  shapes.push({
    kind: 'ellipse',
    cx,
    cy: GROUND_Y + 2,
    rx: 48,
    ry: 9,
    fill: colors.mud,
    opacity: 0.9,
  });
  shapes.push({
    kind: 'ellipse',
    cx,
    cy: GROUND_Y - 1,
    rx: 40,
    ry: 6,
    fill: colors.nest,
    opacity: 0.95,
  });
  for (const [dx, h, lean] of [
    [-34, 30, -12],
    [-26, 40, -6],
    [30, 36, 10],
    [38, 26, 16],
  ] as const) {
    shapes.push({
      kind: 'path',
      d: `M ${n(cx + dx)} ${n(GROUND_Y)} Q ${n(cx + dx + lean * 0.4)} ${n(GROUND_Y - h * 0.6)} ${n(cx + dx + lean)} ${n(GROUND_Y - h)}`,
      stroke: colors.nest,
      strokeWidth: 3,
      fill: 'none',
    });
  }

  const egg = [
    `M ${n(cx)} ${n(top)}`,
    `C ${n(cx + W * 0.38)} ${n(top)} ${n(cx + W * 0.5)} ${n(cy - H * 0.05)} ${n(cx + W * 0.5)} ${n(cy + H * 0.14)}`,
    `C ${n(cx + W * 0.5)} ${n(cy + H * 0.52)} ${n(cx - W * 0.5)} ${n(cy + H * 0.52)} ${n(cx - W * 0.5)} ${n(cy + H * 0.14)}`,
    `C ${n(cx - W * 0.5)} ${n(cy - H * 0.05)} ${n(cx - W * 0.38)} ${n(top)} ${n(cx)} ${n(top)} Z`,
  ].join(' ');

  const eggGroup: Shape[] = [
    { kind: 'path', d: egg, fill: SHELL, stroke: colors.shellSpeckle, strokeWidth: 1 },
  ];
  // Speckles (deterministic).
  const speckles: [number, number, number][] = [
    [-12, -18, 2.2],
    [9, -24, 1.8],
    [16, -4, 2.4],
    [-18, 4, 2],
    [4, 10, 2.6],
    [-6, 22, 1.8],
    [14, 20, 2],
  ];
  for (const [dx, dy, r] of speckles) {
    eggGroup.push({
      kind: 'ellipse',
      cx: cx + dx,
      cy: cy + dy,
      rx: r,
      ry: r * 0.8,
      fill: colors.shellSpeckle,
      opacity: 0.5,
    });
  }
  eggGroup.push({
    kind: 'ellipse',
    cx: cx - W * 0.22,
    cy: cy - H * 0.22,
    rx: 6,
    ry: 11,
    fill: colors.highlight,
    opacity: 0.4,
  });

  const crackY = cy - H * 0.12;
  // What shows through the shell tells the expressions apart at a glance.
  const hatching =
    expression === 'happy' ||
    expression === 'excited' ||
    expression === 'proud' ||
    expression === 'eyesClosed';
  if (hatching) {
    // Opening with the signature amber eye looking out.
    const ox = cx + 2;
    const open = expression === 'excited' ? 1.25 : 1;
    const hole = `M ${n(ox - 13 * open)} ${n(crackY + 1)} L ${n(ox - 7 * open)} ${n(crackY - 7 * open)} L ${n(ox - 1)} ${n(crackY - 3)} L ${n(ox + 5 * open)} ${n(crackY - 9 * open)} L ${n(ox + 12 * open)} ${n(crackY - 2)} L ${n(ox + 9 * open)} ${n(crackY + 6 * open)} L ${n(ox - 3)} ${n(crackY + 9 * open)} L ${n(ox - 10 * open)} ${n(crackY + 6 * open)} Z`;
    eggGroup.push({ kind: 'path', d: hole, fill: colors.pupil });
    const er = 4.6 * open;
    if (expression === 'eyesClosed') {
      eggGroup.push({
        kind: 'path',
        d: `M ${n(ox - er * 0.9)} ${n(crackY - er * 0.1)} Q ${n(ox)} ${n(crackY + er * 0.7)} ${n(ox + er * 0.9)} ${n(crackY - er * 0.1)}`,
        stroke: colors.sparkle,
        strokeWidth: 1.6,
        fill: 'none',
      });
    } else {
      eggGroup.push({ kind: 'ellipse', cx: ox, cy: crackY, rx: er, ry: er, fill: EYE_GRADIENT });
      eggGroup.push({
        kind: 'ellipse',
        cx: ox + er * 0.1,
        cy: crackY,
        rx: er * 0.2 * face.pupilScale,
        ry: er * 0.72,
        fill: colors.pupil,
      });
      eggGroup.push({
        kind: 'ellipse',
        cx: ox + er * 0.38,
        cy: crackY - er * 0.4,
        rx: er * 0.2,
        ry: er * 0.2,
        fill: colors.highlight,
        opacity: 0.9,
      });
      if (face.eyeOpen < 0.8) {
        // Half-closed lid (proud): the dark of the shell covers the top of the eye.
        const lidY = crackY - er + 2 * er * (1 - face.eyeOpen);
        const dy = lidY - crackY;
        const dx = Math.sqrt(Math.max(0, er * er - dy * dy));
        eggGroup.push({
          kind: 'path',
          d: `M ${n(ox - dx)} ${n(lidY)} A ${n(er + 0.5)} ${n(er + 0.5)} 0 0 1 ${n(ox + dx)} ${n(lidY)} Z`,
          fill: colors.pupil,
        });
      }
    }
    eggGroup.push({
      kind: 'path',
      d: hole,
      fill: 'none',
      stroke: colors.shellSpeckle,
      strokeWidth: 1,
    });
  } else {
    eggGroup.push({
      kind: 'path',
      d: `M ${n(cx - 16)} ${n(crackY + 2)} l 6 -6 l 5 6 l 6 -7 l 5 5 l 6 -5 l 5 4`,
      stroke: colors.shellSpeckle,
      strokeWidth: 1.6,
      fill: 'none',
    });
  }

  const tilt = face.jawOpen > 0 ? -face.jawOpen * 0.5 : face.headTilt * 0.5;
  shapes.push({
    kind: 'group',
    transform: tilt ? `rotate(${n(tilt)} ${n(cx)} ${n(GROUND_Y)})` : undefined,
    children: eggGroup,
  });

  if (face.bubbles) {
    shapes.push(...bubbles(cx + W * 0.42, top + 6, colors.bubble));
  }
  for (let i = 0; i < face.sparkles; i++) {
    const spots: [number, number, number][] = [
      [W * 0.75, -H * 0.3, 5],
      [-W * 0.72, -H * 0.1, 3.5],
      [W * 0.55, H * 0.05, 2.8],
    ];
    const [dx, dy, r] = spots[i] ?? [0, 0, 3];
    shapes.push(sparkle(cx + dx, cy + dy, r, colors.sparkle));
  }

  const gradients: LinearGradientDef[] = [
    {
      id: 'shell',
      x1: 0,
      y1: top,
      x2: 0,
      y2: cy + H / 2,
      stops: [
        { offset: 0, color: colors.shell },
        { offset: 0.6, color: colors.shell },
        { offset: 1, color: colors.shellShade },
      ],
    },
  ];
  const eye = hatching ? { cx: cx + 2, cy: crackY, r: 4.6 } : undefined;
  const vb: ViewBox = { x: 0, y: FIGURE_TOP, w: FIGURE_W, h: FIGURE_H - FIGURE_TOP };
  if (pose === 'peek') {
    // The egg "peeks" by sitting in the nest: same drawing, tighter frame.
    return { viewBox: { x: cx - 90, y: top - 24, w: 180, h: 90 }, shapes, eye, gradients };
  }
  return { viewBox: vb, shapes, eye, gradients };
}

function bubbles(x: number, y: number, color: string): Shape[] {
  return [
    {
      kind: 'ellipse',
      cx: x,
      cy: y,
      rx: 2,
      ry: 2,
      fill: 'none',
      stroke: color,
      strokeWidth: 1.4,
      opacity: 0.9,
    },
    {
      kind: 'ellipse',
      cx: x + 5,
      cy: y - 7,
      rx: 3,
      ry: 3,
      fill: 'none',
      stroke: color,
      strokeWidth: 1.4,
      opacity: 0.75,
    },
    {
      kind: 'ellipse',
      cx: x + 12,
      cy: y - 15,
      rx: 4.2,
      ry: 4.2,
      fill: 'none',
      stroke: color,
      strokeWidth: 1.4,
      opacity: 0.6,
    },
  ];
}

/** Builds the full drawing for a stage, expression and pose. Pure and deterministic. */
export function buildCroc(options: BuildOptions): CrocDrawing {
  const {
    stage,
    expression,
    pose,
    colors,
    blink = 1,
    relativeSize = true,
    groundShadow = true,
  } = options;
  const face = FACE_SPECS[expression];

  if (stage === 'egg') return buildEgg(face, expression, colors, pose);

  const spec = STAGE_SPECS[stage];
  const { headR, snoutLen, bodyLen, tailLen, legH } = spec;

  // Head centre: the figure is centred horizontally and stands on the ground line.
  const totalLen = headR + snoutLen + bodyLen + tailLen;
  const hx = FIGURE_W / 2 + totalLen / 2 - snoutLen - headR * 0.15;
  const hy = GROUND_Y - headR - legH * 0.55;

  const eyeOpen = face.eyeOpen * Math.max(0, Math.min(1, blink));
  const g: HeadGeometry = { hx, hy, spec, face, colors, eyeOpen };
  const head = buildHead(g);

  const headGroup: Shape = {
    kind: 'group',
    transform: face.headTilt
      ? `rotate(${n(face.headTilt)} ${n(hx - headR * 0.6)} ${n(hy + headR * 0.6)})`
      : undefined,
    children: head.shapes,
  };

  const extras: Shape[] = [];
  if (face.bubbles)
    extras.push(...bubbles(hx + snoutLen + 6, hy - spec.snoutTipR * 1.9, colors.bubble));
  for (let i = 0; i < face.sparkles; i++) {
    const spots: [number, number, number][] = [
      [snoutLen * 0.55, -headR * 1.75, 6],
      [-headR * 1.6, -headR * 1.45, 4],
      [snoutLen + 10, -headR * 0.9, 3.2],
    ];
    const [dx, dy, r] = spots[i] ?? [0, 0, 3];
    extras.push(sparkle(hx + dx, hy + dy, r, colors.sparkle));
  }

  // Skin gradient: lit along the back, shaded towards the belly. Shared by head, body, tail and legs.
  const skinGradient = (y1: number, y2: number): LinearGradientDef => ({
    id: 'skin',
    x1: 0,
    y1,
    x2: 0,
    y2,
    stops: [
      { offset: 0, color: colors.skinTop },
      { offset: 0.5, color: colors.skin },
      { offset: 1, color: colors.skinShade },
    ],
  });

  if (pose === 'peek') {
    const peek = buildPeekBody(hx, hy, spec, colors);
    const shapes: Shape[] = [...peek.shapes, headGroup, ...extras];
    const waterline = hy + headR * 0.2;
    const minX = peek.minX - 6;
    const maxX = hx + snoutLen + 16;
    const w = maxX - minX;
    const h = Math.max(w * 0.52, (headR * 2.05 + 8) / 0.62);
    const viewBox: ViewBox = { x: minX, y: waterline - h * 0.62, w, h };
    return {
      viewBox,
      shapes,
      eye: head.eye,
      waterline,
      focusX: hx + snoutLen * 0.3,
      gradients: [skinGradient(hy - headR * 1.2, hy + headR * 1.5)],
    };
  }

  const bodyShapes = buildBodyAndTail(hx, hy, spec, colors);
  const figure: Shape[] = [];
  const extent = totalLen;
  if (groundShadow) {
    figure.push({
      kind: 'ellipse',
      cx: FIGURE_W / 2 + headR * 0.1,
      cy: GROUND_Y + 2,
      rx: extent * 0.46,
      ry: 5,
      fill: colors.shadow,
      opacity: 0.16,
    });
  }
  figure.push(...bodyShapes, headGroup, ...extras);

  const scale = relativeSize ? spec.figureScale : 1;
  const group: Shape = {
    kind: 'group',
    transform:
      scale !== 1
        ? `translate(${n(FIGURE_W / 2)} ${n(GROUND_Y)}) scale(${n(scale)}) translate(${n(-FIGURE_W / 2)} ${n(-GROUND_Y)})`
        : undefined,
    children: figure,
  };

  return {
    viewBox: { x: 0, y: FIGURE_TOP, w: FIGURE_W, h: FIGURE_H - FIGURE_TOP },
    shapes: [group],
    eye: head.eye,
    gradients: [skinGradient(hy - headR * 1.2, GROUND_Y)],
  };
}

/** Where the water surface sits in the peek drawing, as a fraction of its height (0 = top). */
export function peekWaterlineRatio(drawing: CrocDrawing): number {
  if (drawing.waterline === undefined) return 0.6;
  return (drawing.waterline - drawing.viewBox.y) / drawing.viewBox.h;
}

/** Where the head sits in the peek drawing, as a fraction of its width (0 = left). */
export function peekFocusRatio(drawing: CrocDrawing): number {
  if (drawing.focusX === undefined) return 0.5;
  return (drawing.focusX - drawing.viewBox.x) / drawing.viewBox.w;
}
