export const AB_LOOP_MIN_GAP_SECONDS = 0.05;

export function isAbLoopBPlacementValid(loopA: number, clickTime: number): boolean {
  return Math.abs(clickTime - loopA) >= AB_LOOP_MIN_GAP_SECONDS;
}

export function resolveAbLoopSeekTarget(
  loopA: number,
  loopB: number,
  currentTime: number,
): number | null {
  const loopStart = Math.min(loopA, loopB);
  const loopEnd = Math.max(loopA, loopB);
  if (loopEnd - loopStart < AB_LOOP_MIN_GAP_SECONDS) {
    return null;
  }
  if (currentTime >= loopEnd) {
    return loopStart;
  }
  return null;
}
