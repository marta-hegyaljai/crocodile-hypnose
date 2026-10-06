import type { CrocExpression, CrocStage } from './types';

/** Proportions of one growth stage, in figure units (adult head radius = 30). */
export interface StageSpec {
  /** Size relative to the grand croc when drawn in the full-body pose. */
  figureScale: number;
  headR: number;
  snoutLen: number;
  snoutTipR: number;
  /** How much the snout top sags between brow and nostril. */
  snoutDip: number;
  eyeR: number;
  socketR: number;
  bodyLen: number;
  tailLen: number;
  legW: number;
  legH: number;
  scutes: number;
  tailScutes: number;
  teeth: number;
  spots: number;
  /** Darker bands across the tail (older crocs). */
  tailBands: number;
  shellCap: boolean;
  /** Heavy brow ridge over the eye (the grand croc's wise look). */
  browRidge: boolean;
  moss: boolean;
  lily: boolean;
}

export const STAGE_SPECS: Record<Exclude<CrocStage, 'egg'>, StageSpec> = {
  hatchling: {
    figureScale: 0.6,
    headR: 30,
    snoutLen: 34,
    snoutTipR: 13,
    snoutDip: 0.5,
    eyeR: 13,
    socketR: 15.5,
    bodyLen: 66,
    tailLen: 52,
    legW: 19,
    legH: 13,
    scutes: 3,
    tailScutes: 1,
    teeth: 0,
    spots: 1,
    tailBands: 0,
    shellCap: true,
    browRidge: false,
    moss: false,
    lily: false,
  },
  juvenile: {
    figureScale: 0.76,
    headR: 30,
    snoutLen: 50,
    snoutTipR: 12,
    snoutDip: 1.2,
    eyeR: 11,
    socketR: 14,
    bodyLen: 92,
    tailLen: 76,
    legW: 22,
    legH: 15,
    scutes: 5,
    tailScutes: 2,
    teeth: 2,
    spots: 2,
    tailBands: 0,
    shellCap: false,
    browRidge: false,
    moss: false,
    lily: false,
  },
  adult: {
    figureScale: 0.9,
    headR: 30,
    snoutLen: 64,
    snoutTipR: 11,
    snoutDip: 2,
    eyeR: 9.5,
    socketR: 12.5,
    bodyLen: 120,
    tailLen: 100,
    legW: 25,
    legH: 17,
    scutes: 7,
    tailScutes: 3,
    teeth: 3,
    spots: 4,
    tailBands: 2,
    shellCap: false,
    browRidge: false,
    moss: false,
    lily: false,
  },
  grand: {
    figureScale: 1,
    headR: 31,
    snoutLen: 70,
    snoutTipR: 11.5,
    snoutDip: 2.4,
    eyeR: 9,
    socketR: 13,
    bodyLen: 135,
    tailLen: 115,
    legW: 27,
    legH: 19,
    scutes: 8,
    tailScutes: 4,
    teeth: 3,
    spots: 5,
    tailBands: 3,
    shellCap: false,
    browRidge: true,
    moss: true,
    lily: true,
  },
};

/** How the face is set for each expression. */
export interface FaceSpec {
  /** 0 closed .. 1 wide open. */
  eyeOpen: number;
  pupilScale: number;
  /** 0 centred .. 1 looking ahead (towards the snout). */
  lookAhead: number;
  /** 0 neutral .. 1 big smile. */
  smile: number;
  /** Lower jaw rotation in degrees. */
  jawOpen: number;
  /** Head rotation in degrees; negative lifts the snout. */
  headTilt: number;
  /** Rotation of the upper lid around the eye, degrees; positive drops the front of the lid (a cool, proud look). */
  lidAngle: number;
  /** 0 none .. 1 raised brow above the eye (surprise / joy). */
  brow: number;
  /** A small round open mouth (a yawn) instead of a smile. */
  yawn: boolean;
  blush: boolean;
  tongue: boolean;
  sparkles: number;
  bubbles: boolean;
}

export const FACE_SPECS: Record<CrocExpression, FaceSpec> = {
  calm: {
    eyeOpen: 0.85,
    pupilScale: 1,
    lookAhead: 0.4,
    smile: 0.3,
    jawOpen: 0,
    headTilt: 0,
    lidAngle: 0,
    brow: 0,
    yawn: false,
    blush: false,
    tongue: false,
    sparkles: 0,
    bubbles: false,
  },
  happy: {
    eyeOpen: 0.92,
    pupilScale: 1.05,
    lookAhead: 0.5,
    smile: 0.85,
    jawOpen: 5,
    headTilt: -2,
    lidAngle: 0,
    brow: 0.6,
    yawn: false,
    blush: true,
    tongue: false,
    sparkles: 0,
    bubbles: false,
  },
  sleepy: {
    eyeOpen: 0.34,
    pupilScale: 0.9,
    lookAhead: 0.2,
    smile: 0.15,
    jawOpen: 0,
    headTilt: 4,
    lidAngle: -8,
    brow: 0,
    yawn: true,
    blush: false,
    tongue: false,
    sparkles: 0,
    bubbles: true,
  },
  excited: {
    eyeOpen: 1,
    pupilScale: 1.25,
    lookAhead: 0.6,
    smile: 1,
    jawOpen: 9,
    headTilt: -5,
    lidAngle: 0,
    brow: 1,
    yawn: false,
    blush: true,
    tongue: true,
    sparkles: 3,
    bubbles: false,
  },
  proud: {
    eyeOpen: 0.62,
    pupilScale: 0.9,
    lookAhead: 0.1,
    smile: 0.7,
    jawOpen: 0,
    headTilt: -9,
    lidAngle: 14,
    brow: 0,
    yawn: false,
    blush: false,
    tongue: false,
    sparkles: 1,
    bubbles: false,
  },
  eyesClosed: {
    eyeOpen: 0,
    pupilScale: 1,
    lookAhead: 0,
    smile: 0.6,
    jawOpen: 0,
    headTilt: 0,
    lidAngle: 0,
    brow: 0,
    yawn: false,
    blush: false,
    tongue: false,
    sparkles: 0,
    bubbles: false,
  },
};
