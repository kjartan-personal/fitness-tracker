// ---------------------------------------------------------------------------
// Core domain models for the hypertrophy PWA.
// All weights in kg. Dates stored as ISO strings; "day keys" as YYYY-MM-DD.
// ---------------------------------------------------------------------------

export type DayType = "upper" | "lower";

/** Drives default rest and progression increment. */
export type ExerciseType =
  | "heavy_compound" // bench, OHP, squat, RDL, barbell row
  | "secondary_compound" // incline press, hack squat, leg press, pulldown
  | "isolation"; // lateral raises, curls, extensions, leg curls, calves

/** Role a movement plays within its pattern's rotation. */
export type PatternRole = "anchor" | "variation" | "accessory";

/** A movement in the exercise catalog (static seed data). */
export interface Exercise {
  id: string;
  name: string;
  type: ExerciseType;
  role: PatternRole;
  /** [min, max] target reps for double progression. */
  repRange: [number, number];
  /** Baseline working-set count during accumulation. */
  baseSets: number;
  /** Weight jump when the top of the rep range is cleared on all sets. */
  incrementKg: number;
  /** Default rest between sets, seconds (user-overridable). */
  restSeconds: number;
  muscleGroup: string;
}

/**
 * A movement pattern with one anchor kept across blocks and a pool of
 * variations/accessories that advance each new mesocycle.
 */
export interface Pattern {
  key: string;
  dayType: DayType;
  label: string;
  /** Kept across all blocks for progression continuity. Accessories have none. */
  anchorId?: string;
  /** Rotating options; index advances by block number. */
  poolIds: string[];
}

// --- Persisted records -----------------------------------------------------

/** The active training block. `selections` maps pattern.key -> exercise id. */
export interface Mesocycle {
  id: string;
  blockNumber: number;
  startDate: string; // ISO
  selections: Record<string, string>;
}

/** Where the user currently sits inside the active mesocycle. */
export interface CycleState {
  id: "current";
  mesocycleId: string;
  week: number; // 1..5 (5 = deload)
  nextDayType: DayType; // alternates upper/lower each session
  completedSessions: number;
}

export interface LoggedSet {
  weight: number;
  reps: number;
  /** Reps in reserve at the end of the set (0 = to failure). Optional. */
  rir?: number;
}

export interface LoggedExercise {
  exerciseId: string;
  sets: LoggedSet[];
}

/** A finished (or in-progress) training session. */
export interface WorkoutLog {
  id: string;
  date: string; // ISO
  dayType: DayType;
  mesocycleId: string;
  blockNumber: number;
  week: number;
  entries: LoggedExercise[];
  completedAt?: string; // ISO; unset while in progress
}

export interface BodyweightEntry {
  id: string;
  date: string; // ISO
  weightKg: number;
}

/** One calendar day of nutrition tracking, keyed by YYYY-MM-DD. */
export interface ProteinDay {
  date: string; // YYYY-MM-DD (also the primary key)
  grams: number;
  ateWell?: boolean;
}

export interface Settings {
  id: "settings";
  bodyweightKg: number;
  proteinPerKg: number; // 1.6–2.2, default 1.8
  unit: "kg";
  /** User-supplied starting working weight per exercise id (onboarding). */
  startingWeights: Record<string, number>;
  /** Per-exercise rest overrides in seconds. */
  restOverrides: Record<string, number>;
  /** Forced exercise choice per pattern key; overrides block rotation. */
  patternSelections: Record<string, string>;
  /** Pattern keys the user has turned off — skipped in every workout. */
  disabledPatterns: string[];
  /** ISO timestamp of the last successful data export, for the backup nudge. */
  lastBackupAt?: string;
  /** Show per-week RIR targets and use logged RIR to autoregulate load. */
  rirEnabled: boolean;
  /** Detect plateaus and suggest per-exercise back-offs / accessory swaps. */
  stallDetection: boolean;
  /** Number of recent sessions with no progress that counts as a stall (2–3). */
  stallWindow: number;
}

// --- Derived (not persisted) ----------------------------------------------

/** A single exercise slot in today's prescribed workout. */
export interface PrescribedExercise {
  exercise: Exercise;
  patternKey: string;
  targetSets: number;
  repRange: [number, number];
  suggestedWeight: number;
  repTarget: number; // reps to aim for at the suggested weight
  targetRir: number; // reps-in-reserve to aim for this week
  restSeconds: number;
  /** Last time this exercise was performed, for reference. */
  last?: { weight: number; reps: number[]; date: string };
  /** Why this weight was chosen. */
  note: "increase" | "add_reps" | "starting" | "deload" | "too_easy" | "stall_backoff";
  /** For a stalled accessory: an alternative exercise id to swap to. */
  swapSuggestion?: string;
}

export interface Prescription {
  dayType: DayType;
  blockNumber: number;
  week: number;
  isDeload: boolean;
  exercises: PrescribedExercise[];
  projectedMinutes: number;
  overBudget: boolean;
}
