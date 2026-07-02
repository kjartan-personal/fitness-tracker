import type { Exercise, ExerciseType, Pattern, PatternRole } from "@/types/models";

// Type-driven defaults (mid-points of the spec's rest ranges + sensible
// hypertrophy rep ranges). Individual exercises can override any field.
const DEFAULTS: Record<
  ExerciseType,
  { repRange: [number, number]; baseSets: number; incrementKg: number; restSeconds: number }
> = {
  heavy_compound: { repRange: [6, 9], baseSets: 3, incrementKg: 5, restSeconds: 135 },
  secondary_compound: { repRange: [8, 12], baseSets: 3, incrementKg: 2.5, restSeconds: 105 },
  isolation: { repRange: [10, 15], baseSets: 2, incrementKg: 2, restSeconds: 60 },
};

function ex(
  id: string,
  name: string,
  type: ExerciseType,
  role: PatternRole,
  muscleGroup: string,
  overrides: Partial<Exercise> = {},
): Exercise {
  return { id, name, type, role, muscleGroup, ...DEFAULTS[type], ...overrides };
}

// --- Exercise catalog ------------------------------------------------------

export const EXERCISES: Exercise[] = [
  // Horizontal push
  ex("bb_bench", "Barbell Bench Press", "heavy_compound", "anchor", "Chest", { incrementKg: 2.5 }),
  ex("incline_db_press", "Incline DB Press", "secondary_compound", "variation", "Chest"),
  ex("machine_chest_press", "Machine Chest Press", "secondary_compound", "variation", "Chest"),
  ex("flat_db_press", "Flat DB Press", "secondary_compound", "variation", "Chest"),

  // Vertical push
  ex("bb_ohp", "Overhead Press", "heavy_compound", "anchor", "Shoulders", { incrementKg: 2.5 }),
  ex("seated_db_press", "Seated DB Shoulder Press", "secondary_compound", "variation", "Shoulders"),
  ex("machine_shoulder_press", "Machine Shoulder Press", "secondary_compound", "variation", "Shoulders"),

  // Horizontal pull
  ex("bb_row", "Barbell Row", "heavy_compound", "anchor", "Back", { incrementKg: 2.5 }),
  ex("chest_supported_row", "Chest-Supported Row", "secondary_compound", "variation", "Back"),
  ex("seated_cable_row", "Seated Cable Row", "secondary_compound", "variation", "Back"),
  ex("machine_row", "Machine Row", "secondary_compound", "variation", "Back"),

  // Vertical pull
  ex("lat_pulldown", "Lat Pulldown", "heavy_compound", "anchor", "Back", { incrementKg: 2.5 }),
  ex("wide_pulldown", "Wide-Grip Pulldown", "secondary_compound", "variation", "Back"),
  ex("neutral_pulldown", "Neutral-Grip Pulldown", "secondary_compound", "variation", "Back"),

  // Side delts (accessory)
  ex("db_lateral_raise", "DB Lateral Raise", "isolation", "accessory", "Shoulders", { incrementKg: 1 }),
  ex("cable_lateral_raise", "Cable Lateral Raise", "isolation", "accessory", "Shoulders", { incrementKg: 1 }),

  // Biceps (accessory)
  ex("db_curl", "DB Curl", "isolation", "accessory", "Biceps"),
  ex("cable_curl", "Cable Curl", "isolation", "accessory", "Biceps"),
  ex("ez_curl", "EZ-Bar Curl", "isolation", "accessory", "Biceps"),

  // Triceps (accessory)
  ex("rope_pushdown", "Rope Pushdown", "isolation", "accessory", "Triceps"),
  ex("overhead_ext", "Overhead Extension", "isolation", "accessory", "Triceps"),
  ex("dips", "Dips", "isolation", "accessory", "Triceps", { incrementKg: 2.5 }),

  // Squat
  ex("back_squat", "Back Squat", "heavy_compound", "anchor", "Quads"),
  ex("hack_squat", "Hack Squat", "secondary_compound", "variation", "Quads", { incrementKg: 5 }),
  ex("leg_press", "Leg Press", "secondary_compound", "variation", "Quads", { incrementKg: 5 }),
  ex("front_squat", "Front Squat", "secondary_compound", "variation", "Quads"),

  // Hinge
  ex("rdl", "Romanian Deadlift", "heavy_compound", "anchor", "Hamstrings"),
  ex("deadlift", "Conventional Deadlift", "heavy_compound", "variation", "Hamstrings"),
  ex("hip_thrust", "Hip Thrust", "secondary_compound", "variation", "Glutes", { incrementKg: 5 }),

  // Single-leg (accessory)
  ex("bulgarian_split", "Bulgarian Split Squat", "secondary_compound", "accessory", "Quads"),
  ex("walking_lunge", "Walking Lunge", "secondary_compound", "accessory", "Quads"),
  ex("single_leg_press", "Single-Leg Leg Press", "secondary_compound", "accessory", "Quads", { incrementKg: 5 }),

  // Quad isolation (accessory)
  ex("leg_extension", "Leg Extension", "isolation", "accessory", "Quads"),

  // Hamstring isolation (accessory)
  ex("seated_leg_curl", "Seated Leg Curl", "isolation", "accessory", "Hamstrings"),
  ex("lying_leg_curl", "Lying Leg Curl", "isolation", "accessory", "Hamstrings"),

  // Calves (accessory)
  ex("standing_calf", "Standing Calf Raise", "isolation", "accessory", "Calves", { incrementKg: 2.5 }),
  ex("seated_calf", "Seated Calf Raise", "isolation", "accessory", "Calves", { incrementKg: 2.5 }),
];

export const EXERCISE_BY_ID: Record<string, Exercise> = Object.fromEntries(
  EXERCISES.map((e) => [e.id, e]),
);

/** Unique muscle groups in catalog order (push → pull → legs). */
export const MUSCLE_GROUPS: string[] = [...new Set(EXERCISES.map((e) => e.muscleGroup))];

// --- Movement patterns (rotation pools) ------------------------------------
// For each new mesocycle, anchors stay and each pattern's selected exercise
// advances to the next option in `poolIds` (see engine/mesocycle.ts).

export const PATTERNS: Pattern[] = [
  // Upper day
  {
    key: "horizontal_push",
    dayType: "upper",
    label: "Horizontal Push",
    anchorId: "bb_bench",
    poolIds: ["incline_db_press", "machine_chest_press", "flat_db_press"],
  },
  {
    key: "vertical_push",
    dayType: "upper",
    label: "Vertical Push",
    anchorId: "bb_ohp",
    poolIds: ["seated_db_press", "machine_shoulder_press"],
  },
  {
    key: "horizontal_pull",
    dayType: "upper",
    label: "Horizontal Pull",
    anchorId: "bb_row",
    poolIds: ["chest_supported_row", "seated_cable_row", "machine_row"],
  },
  {
    key: "vertical_pull",
    dayType: "upper",
    label: "Vertical Pull",
    anchorId: "lat_pulldown",
    poolIds: ["wide_pulldown", "neutral_pulldown"],
  },
  {
    key: "side_delts",
    dayType: "upper",
    label: "Side Delts",
    poolIds: ["db_lateral_raise", "cable_lateral_raise"],
  },
  {
    key: "biceps",
    dayType: "upper",
    label: "Biceps",
    poolIds: ["db_curl", "cable_curl", "ez_curl"],
  },
  {
    key: "triceps",
    dayType: "upper",
    label: "Triceps",
    poolIds: ["rope_pushdown", "overhead_ext", "dips"],
  },

  // Lower day
  {
    key: "squat",
    dayType: "lower",
    label: "Squat",
    anchorId: "back_squat",
    poolIds: ["hack_squat", "leg_press", "front_squat"],
  },
  {
    key: "hinge",
    dayType: "lower",
    label: "Hinge",
    anchorId: "rdl",
    poolIds: ["deadlift", "hip_thrust"],
  },
  {
    key: "single_leg",
    dayType: "lower",
    label: "Single-Leg",
    poolIds: ["bulgarian_split", "walking_lunge", "single_leg_press"],
  },
  {
    key: "quad_iso",
    dayType: "lower",
    label: "Quad Isolation",
    poolIds: ["leg_extension"],
  },
  {
    key: "ham_iso",
    dayType: "lower",
    label: "Hamstring Isolation",
    poolIds: ["seated_leg_curl", "lying_leg_curl"],
  },
  {
    key: "calves",
    dayType: "lower",
    label: "Calves",
    poolIds: ["standing_calf", "seated_calf"],
  },
];

export const PATTERNS_BY_DAY: Record<"upper" | "lower", Pattern[]> = {
  upper: PATTERNS.filter((p) => p.dayType === "upper"),
  lower: PATTERNS.filter((p) => p.dayType === "lower"),
};
