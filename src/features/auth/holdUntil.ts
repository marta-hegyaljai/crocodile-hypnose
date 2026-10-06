/**
 * Waits until at least `minMs` have passed since `startedAt`. Used before showing a fast failure,
 * so a Retry that fails again still visibly does something (spinner, then the message again).
 */
export function holdUntil(startedAt: number, minMs = 500): Promise<void> {
  const remaining = startedAt + minMs - Date.now();
  return remaining > 0 ? new Promise((r) => setTimeout(r, remaining)) : Promise.resolve();
}
