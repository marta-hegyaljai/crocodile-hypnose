export interface MotionSource {
  /** Resolves once it is known whether the sensor delivers readings on this device. */
  available: Promise<boolean>;
  stop(): void;
}
