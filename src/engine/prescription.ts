import { EXERCISE_BY_ID, PATTERNS_BY_DAY } from "@/data/catalog";
import type {
  CycleState,
  Mesocycle,
  Prescription,
  Settings,
  WorkoutLog,
} from "@/types/models";
import { isDeloadWeek } from "./mesocycle";
import { prescribeExercise, recentSessions } from "./progression";
import { isOverBudget, projectMinutes } from "./timing";

/**
 * Assemble the prescribed workout for the user's current position.
 * `history` should be all past workouts, newest-first.
 */
export function buildPrescription(
  cycle: CycleState,
  meso: Mesocycle,
  history: WorkoutLog[],
  settings: Settings,
): Prescription {
  const dayType = cycle.nextDayType;
  const patterns = PATTERNS_BY_DAY[dayType];

  const disabled = new Set(settings.disabledPatterns ?? []);
  const overrides = settings.patternSelections ?? {};
  const opts = {
    rirEnabled: settings.rirEnabled ?? true,
    stallDetection: settings.stallDetection ?? true,
    stallWindow: settings.stallWindow ?? 3,
  };
  const lookback = Math.max(3, opts.stallWindow);

  const exercises = patterns
    .filter((pattern) => !disabled.has(pattern.key))
    .map((pattern) => {
      // User's explicit swap wins over the block's rotation default.
      const exerciseId = overrides[pattern.key] ?? meso.selections[pattern.key];
      const exercise = EXERCISE_BY_ID[exerciseId];
      if (!exercise) return null;
      const restSeconds = settings.restOverrides[exerciseId] ?? exercise.restSeconds;
      const sessions = recentSessions(history, exerciseId, lookback);
      const startingWeight = settings.startingWeights[exerciseId];
      return prescribeExercise(
        pattern,
        exercise,
        cycle.week,
        restSeconds,
        startingWeight,
        sessions,
        opts,
      );
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const projectedMinutes = projectMinutes(exercises);

  return {
    dayType,
    blockNumber: meso.blockNumber,
    week: cycle.week,
    isDeload: isDeloadWeek(cycle.week),
    exercises,
    projectedMinutes,
    overBudget: isOverBudget(projectedMinutes),
  };
}
