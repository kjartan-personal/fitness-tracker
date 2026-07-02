import Dexie, { type Table } from "dexie";
import type {
  BodyweightEntry,
  CycleState,
  Mesocycle,
  ProteinDay,
  Settings,
  WorkoutLog,
} from "@/types/models";

export class HypertrophyDB extends Dexie {
  settings!: Table<Settings, string>;
  cycleState!: Table<CycleState, string>;
  mesocycles!: Table<Mesocycle, string>;
  workouts!: Table<WorkoutLog, string>;
  bodyweight!: Table<BodyweightEntry, string>;
  protein!: Table<ProteinDay, string>;

  constructor() {
    super("hypertrophy");
    this.version(1).stores({
      settings: "id",
      cycleState: "id",
      mesocycles: "id, blockNumber",
      workouts: "id, date, dayType, mesocycleId",
      bodyweight: "id, date",
      protein: "date",
    });

    // v2: backfill Settings fields added for the Settings screen.
    this.version(2).upgrade(async (tx) => {
      const s = await tx.table("settings").get("settings");
      if (s) {
        s.startingWeights ??= {};
        s.restOverrides ??= {};
        s.patternSelections ??= {};
        s.disabledPatterns ??= [];
        await tx.table("settings").put(s);
      }
    });

    // v3: backfill RIR / stall-detection settings.
    this.version(3).upgrade(async (tx) => {
      const s = await tx.table("settings").get("settings");
      if (s) {
        s.rirEnabled ??= true;
        s.stallDetection ??= true;
        s.stallWindow ??= 3;
        await tx.table("settings").put(s);
      }
    });
  }
}

export const db = new HypertrophyDB();
