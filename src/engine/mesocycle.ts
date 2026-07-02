import { PATTERNS } from "@/data/catalog";
import type { Mesocycle } from "@/types/models";

export const WEEKS_PER_BLOCK = 5; // 4 accumulation + 1 deload
export const DELOAD_WEEK = 5;

export function isDeloadWeek(week: number): boolean {
  return week >= DELOAD_WEEK;
}

/**
 * Resolve the exercise a pattern uses for a given block.
 * Anchors stay across all blocks (compound progression continuity);
 * accessory patterns (no anchor) swap to the next pool option each block.
 */
export function selectionForPattern(patternKey: string, blockNumber: number): string {
  const pattern = PATTERNS.find((p) => p.key === patternKey);
  if (!pattern) throw new Error(`Unknown pattern: ${patternKey}`);
  if (pattern.anchorId) return pattern.anchorId;
  const idx = (blockNumber - 1) % pattern.poolIds.length;
  return pattern.poolIds[idx];
}

/** Build the exercise selections for every pattern for a block. */
export function buildSelections(blockNumber: number): Record<string, string> {
  const selections: Record<string, string> = {};
  for (const p of PATTERNS) selections[p.key] = selectionForPattern(p.key, blockNumber);
  return selections;
}

export function createMesocycle(blockNumber: number, startDate = new Date()): Mesocycle {
  return {
    id: `block-${blockNumber}`,
    blockNumber,
    startDate: startDate.toISOString(),
    selections: buildSelections(blockNumber),
  };
}

/**
 * Advance cycle position after finishing a session. Sessions alternate
 * upper/lower; two sessions (one upper + one lower) advance the week.
 * After the deload week completes, a new block begins.
 */
export function advancePosition(current: {
  week: number;
  nextDayType: "upper" | "lower";
  completedSessions: number;
  blockNumber: number;
}): {
  week: number;
  nextDayType: "upper" | "lower";
  completedSessions: number;
  startNewBlock: boolean;
} {
  const completedSessions = current.completedSessions + 1;
  const nextDayType = current.nextDayType === "upper" ? "lower" : "upper";
  // Advance a week every two sessions (after completing a lower day).
  const advanceWeek = current.nextDayType === "lower";
  let week = advanceWeek ? current.week + 1 : current.week;
  let startNewBlock = false;
  if (week > WEEKS_PER_BLOCK) {
    week = 1;
    startNewBlock = true;
  }
  return { week, nextDayType, completedSessions, startNewBlock };
}
