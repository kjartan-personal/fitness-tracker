import { db } from "./db";
import { createMesocycle } from "@/engine/mesocycle";
import type { CycleState, Settings } from "@/types/models";

const DEFAULT_BODYWEIGHT = 75;
const DEFAULT_PROTEIN_PER_KG = 1.8;

/**
 * First-run initialization: create Settings, generate Block 1, and place the
 * user at week 1 / upper day. Idempotent — safe to call on every boot.
 */
export async function ensureSeeded(): Promise<void> {
  const existing = await db.settings.get("settings");
  if (existing) return;

  await db.transaction("rw", db.settings, db.cycleState, db.mesocycles, async () => {
    const settings: Settings = {
      id: "settings",
      bodyweightKg: DEFAULT_BODYWEIGHT,
      proteinPerKg: DEFAULT_PROTEIN_PER_KG,
      unit: "kg",
      startingWeights: {},
      restOverrides: {},
      patternSelections: {},
      disabledPatterns: [],
      rirEnabled: true,
      stallDetection: true,
      stallWindow: 3,
    };
    await db.settings.put(settings);

    const meso = createMesocycle(1);
    await db.mesocycles.put(meso);

    const cycle: CycleState = {
      id: "current",
      mesocycleId: meso.id,
      week: 1,
      nextDayType: "upper",
      completedSessions: 0,
    };
    await db.cycleState.put(cycle);
  });
}
