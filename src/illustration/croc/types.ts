export type CrocStage = 'egg' | 'hatchling' | 'juvenile' | 'adult' | 'grand';
export type CrocExpression = 'calm' | 'happy' | 'sleepy' | 'excited' | 'proud' | 'eyesClosed';
export type CrocPose = 'full' | 'peek';

export const CROC_STAGES: readonly CrocStage[] = ['egg', 'hatchling', 'juvenile', 'adult', 'grand'];
export const CROC_EXPRESSIONS: readonly CrocExpression[] = [
  'calm',
  'happy',
  'sleepy',
  'excited',
  'proud',
  'eyesClosed',
];

/** Fill sentinel replaced by the renderer with the amber radial gradient. */
export const EYE_GRADIENT = '@eye';

/** Fill sentinel prefix for a named linear gradient declared in `CrocDrawing.gradients`. */
export const GRADIENT_PREFIX = '@grad:';
export const gradientFill = (id: string) => `${GRADIENT_PREFIX}${id}`;

export interface LinearGradientDef {
  id: string;
  /** User-space coordinates (same space as the shapes). */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stops: { offset: number; color: string }[];
}

export interface Point {
  x: number;
  y: number;
}

export type Shape =
  | {
      kind: 'path';
      d: string;
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      opacity?: number;
      dash?: string;
    }
  | {
      kind: 'ellipse';
      cx: number;
      cy: number;
      rx: number;
      ry: number;
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      opacity?: number;
    }
  | {
      kind: 'group';
      /** SVG transform string, e.g. "rotate(-5 120 80)". */
      transform?: string;
      opacity?: number;
      children: Shape[];
    };

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CrocColors {
  skin: string;
  skinLight: string;
  skinDark: string;
  /** Lit top of the back and head (gradient start). */
  skinTop: string;
  /** Shaded underside (gradient end). */
  skinShade: string;
  belly: string;
  scute: string;
  pupil: string;
  highlight: string;
  mouth: string;
  tongue: string;
  teeth: string;
  blush: string;
  shell: string;
  shellShade: string;
  shellSpeckle: string;
  moss: string;
  lily: string;
  lilyCenter: string;
  sparkle: string;
  bubble: string;
  shadow: string;
  nest: string;
  mud: string;
}

export interface CrocDrawing {
  viewBox: ViewBox;
  shapes: Shape[];
  /** Eye centre and radius (for the gradient); absent for the egg without a visible eye. */
  eye?: { cx: number; cy: number; r: number };
  /** Y of the water surface in viewBox units for the peek pose. */
  waterline?: number;
  /** X of the head centre in viewBox units (peek pose): what a scene should centre on. */
  focusX?: number;
  /** Linear gradients referenced by `gradientFill(id)` fills. */
  gradients?: LinearGradientDef[];
}
