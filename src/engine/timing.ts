import type { PrescribedExercise } from "@/types/models";

/** Assumed time to perform one working set (approach + lift), seconds. */
const WORKING_SET_SECONDS = 40;

/** Target session budget from the spec. */
export const BUDGET_MINUTES = 45;

/**
 * Estimate total session time: for each exercise, (sets × working-set time)
 * plus rest after every set except the last of the last exercise. We keep it
 * simple and count rest × sets, which slightly over-estimates (a safe margin).
 */
export function projectMinutes(exercises: PrescribedExercise[]): number {
  let seconds = 0;
  for (const ex of exercises) {
    seconds += ex.targetSets * (WORKING_SET_SECONDS + ex.restSeconds);
  }
  return Math.round(seconds / 60);
}

export function isOverBudget(minutes: number): boolean {
  return minutes > BUDGET_MINUTES;
}
