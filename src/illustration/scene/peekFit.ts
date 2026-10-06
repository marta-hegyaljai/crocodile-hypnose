import { crocColors } from '../croc/colors';
import { buildCroc, peekWaterlineRatio } from '../croc/geometry';
import type { CrocExpression, CrocStage } from '../croc/types';

export interface PeekFitOptions {
  stage: CrocStage;
  expression: CrocExpression;
  /** Free vertical band (screen coordinates) the peeking croc and its water must fit into. */
  top: number;
  bottom: number;
  /** Width of the whole croc drawing at most / at least. */
  maxWidth: number;
  minWidth?: number;
  /** Space kept between `top` and the croc's head. */
  margin?: number;
  /** Water kept visible under the waterline. */
  minWater?: number;
}

/**
 * Sizes and places a peeking croc so its head never runs into content above it (a title, a
 * greeting) and some water stays visible above content below it (a sheet). Returns the croc width
 * and the y of the water surface, for `Lagoon`'s `crocWidth` and `waterTop`.
 */
export function fitPeekCroc({
  stage,
  expression,
  top,
  bottom,
  maxWidth,
  minWidth = 140,
  margin = 16,
  minWater = 40,
}: PeekFitOptions): { crocWidth: number; waterY: number } {
  const drawing = buildCroc({ stage, expression, pose: 'peek', colors: crocColors('daylight') });
  // Height of the drawing above the waterline, per point of width.
  const above = peekWaterlineRatio(drawing) * (drawing.viewBox.h / drawing.viewBox.w);
  const room = bottom - top - margin - minWater;
  const width = Math.max(minWidth, Math.min(maxWidth, room / above));
  const crocAbove = width * above;
  const free = Math.max(0, room - crocAbove);
  // A little more water than sky between the croc and the sheet reads as "in the river".
  const waterY = top + margin + crocAbove + free * 0.4;
  return { crocWidth: Math.round(width), waterY: Math.round(waterY) };
}
