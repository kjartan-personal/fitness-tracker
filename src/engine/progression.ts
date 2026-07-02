import type { Exercise, Pattern, PrescribedExercise, WorkoutLog } from "@/types/models";
import { isDeloadWeek } from "./mesocycle";

const DELOAD_LOAD_FACTOR = 0.85; // ~15% off during the deload week
const BACKOFF_FACTOR = 0.9; // ~10% drop when an exercise stalls
const TOO_EASY_RIR = 2; // hit top reps with ≥ this RIR ⇒ bump harder

/** Round to the nearest 0.5 kg (smallest plate/microload we assume). */
function round(w: number): number {
  return Math.round(w * 2) / 2;
}

/** Working-set count for a week: ramps up in accumulation, drops on deload. */
export function targetSetsFor(exercise: Exercise, week: number): number {
  if (isDeloadWeek(week)) return Math.max(1, exercise.baseSets - 1);
  // Add a top set in the back half of accumulation for progressive volume.
  return week >= 3 ? exercise.baseSets + 1 : exercise.baseSets;
}

/** Target reps-in-reserve for the week: intensity climbs, deload backs way off. */
export function targetRirFor(week: number): number {
  if (isDeloadWeek(week)) return 5;
  return [0, 3, 2, 1, 1][week] ?? 2; // wk1→3, wk2→2, wk3→1, wk4→1
}

/** A summarized past performance of one exercise, newest-first when listed. */
export interface WorkSession {
  date: string;
  weight: number; // top working weight used
  reps: number[];
  rir: (number | undefined)[];
  est1RM: number;
}

/** The most recent `n` sessions for an exercise, newest-first. */
export function recentSessions(
  history: WorkoutLog[],
  exerciseId: string,
  n: number,
): WorkSession[] {
  const out: WorkSession[] = [];
  for (const log of history) {
    if (!log.completedAt) continue;
    const entry = log.entries.find((e) => e.exerciseId === exerciseId && e.sets.length > 0);
    if (!entry) continue;
    out.push({
      date: log.date,
      weight: Math.max(...entry.sets.map((s) => s.weight)),
      reps: entry.sets.map((s) => s.reps),
      rir: entry.sets.map((s) => s.rir),
      est1RM: Math.max(...entry.sets.map((s) => s.weight * (1 + s.reps / 30))),
    });
    if (out.length >= n) break;
  }
  return out;
}

function definedMinRir(rir: (number | undefined)[]): number | undefined {
  const vals = rir.filter((r): r is number => r != null);
  return vals.length ? Math.min(...vals) : undefined;
}

/**
 * Stalled = estimated 1RM hasn't improved across the window (plateau), OR the
 * last two sessions were taken to failure (RIR ≤ 0) without adding reps (grind).
 */
export function isStalled(sessions: WorkSession[], window: number): boolean {
  if (sessions.length < window) return false;

  const baseline = sessions[window - 1].est1RM;
  const recentBest = Math.max(...sessions.slice(0, window - 1).map((s) => s.est1RM));
  const plateau = recentBest <= baseline + 1e-6;

  let grinding = false;
  if (sessions.length >= 2) {
    const r0 = definedMinRir(sessions[0].rir);
    const r1 = definedMinRir(sessions[1].rir);
    const total = (s: WorkSession) => s.reps.reduce((a, b) => a + b, 0);
    grinding = r0 != null && r1 != null && r0 <= 0 && r1 <= 0 && total(sessions[0]) <= total(sessions[1]);
  }
  return plateau || grinding;
}

/** True if a ≥5% load drop happened within the recent window (a prior back-off). */
function backedOffRecently(sessions: WorkSession[], window: number): boolean {
  for (let i = 0; i < Math.min(sessions.length - 1, window); i++) {
    if (sessions[i].weight <= sessions[i + 1].weight * 0.95) return true;
  }
  return false;
}

export interface PrescribeOpts {
  rirEnabled: boolean;
  stallDetection: boolean;
  stallWindow: number;
}

/**
 * Build one exercise's prescription. Base logic is double progression; RIR
 * autoregulates the size of the jump, and stall detection triggers a per-
 * exercise back-off (plus a swap hint for accessories). Deload overrides all.
 */
export function prescribeExercise(
  pattern: Pattern,
  exercise: Exercise,
  week: number,
  restSeconds: number,
  startingWeight: number | undefined,
  sessions: WorkSession[],
  opts: PrescribeOpts,
): PrescribedExercise {
  const [minReps, maxReps] = exercise.repRange;
  const targetSets = targetSetsFor(exercise, week);
  const targetRir = targetRirFor(week);
  const last = sessions[0];

  let suggestedWeight = startingWeight ?? 0;
  let repTarget = minReps;
  let note: PrescribedExercise["note"] = "starting";
  let swapSuggestion: string | undefined;

  if (last) {
    const hitTopOnAll = last.reps.length >= targetSets && last.reps.every((r) => r >= maxReps);
    const minRir = definedMinRir(last.rir);
    if (hitTopOnAll) {
      if (opts.rirEnabled && minRir != null && minRir >= TOO_EASY_RIR) {
        // Cleared the range with reps to spare → jump harder.
        suggestedWeight = round(last.weight + 2 * exercise.incrementKg);
        note = "too_easy";
      } else {
        suggestedWeight = round(last.weight + exercise.incrementKg);
        note = "increase";
      }
      repTarget = minReps;
    } else {
      suggestedWeight = last.weight;
      const lowest = Math.min(...last.reps);
      repTarget = Math.min(maxReps, Math.max(minReps, lowest + 1));
      note = "add_reps";
    }
  }

  // Per-exercise back-off on a stall (never during deload, and not right after
  // a previous back-off — let double progression rebuild first).
  if (
    opts.stallDetection &&
    !isDeloadWeek(week) &&
    last &&
    isStalled(sessions, opts.stallWindow) &&
    !backedOffRecently(sessions, opts.stallWindow)
  ) {
    suggestedWeight = round(last.weight * BACKOFF_FACTOR);
    repTarget = minReps;
    note = "stall_backoff";
    if (exercise.role === "accessory") {
      swapSuggestion = pattern.poolIds.find((id) => id !== exercise.id);
    }
  }

  // Scheduled deload overrides everything.
  if (isDeloadWeek(week)) {
    const base = last?.weight ?? startingWeight ?? 0;
    suggestedWeight = round(base * DELOAD_LOAD_FACTOR);
    repTarget = minReps;
    note = "deload";
    swapSuggestion = undefined;
  }

  return {
    exercise,
    patternKey: pattern.key,
    targetSets,
    repRange: exercise.repRange,
    suggestedWeight,
    repTarget,
    targetRir,
    restSeconds,
    last: last ? { weight: last.weight, reps: last.reps, date: last.date } : undefined,
    note,
    swapSuggestion,
  };
}
