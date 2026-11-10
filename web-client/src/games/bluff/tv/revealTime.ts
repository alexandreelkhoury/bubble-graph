// The /tv reveal clock (pure): GAME-BLUFF §12.2 timing shared with the phone (PhReveal) and the native TV.
/**
 * Where the reveal stands now: the same rule as the phone (PhReveal) and the native TV (BluffMoments): the reveal began
 * at deadline − durationMs, so a /tv reload or reconnect joins it mid-way instead of replaying it, in step with phones.
 */
export function revealElapsed(deadline: number | null, durationMs: number, serverNowMs: number, total: number): number {
  if (deadline === null) return 0;
  return Math.min(total, Math.max(0, serverNowMs - (deadline - durationMs)));
}
