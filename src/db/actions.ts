import { db } from "./db";
import { dayKey } from "@/engine/dates";
import { advancePosition, createMesocycle } from "@/engine/mesocycle";
import type { ProteinDay, Settings, WorkoutLog } from "@/types/models";

async function getSettings(): Promise<Settings> {
  const s = await db.settings.get("settings");
  if (!s) throw new Error("Settings not initialized");
  return s;
}

// --- Nutrition -------------------------------------------------------------

export async function addProtein(grams: number, date = dayKey()): Promise<void> {
  const existing = await db.protein.get(date);
  const next: ProteinDay = {
    date,
    grams: Math.max(0, (existing?.grams ?? 0) + grams),
    ateWell: existing?.ateWell,
  };
  await db.protein.put(next);
}

export async function setAteWell(value: boolean, date = dayKey()): Promise<void> {
  const existing = await db.protein.get(date);
  await db.protein.put({ date, grams: existing?.grams ?? 0, ateWell: value });
}

// --- Settings / onboarding -------------------------------------------------

export async function setStartingWeight(exerciseId: string, kg: number): Promise<void> {
  const s = await getSettings();
  await db.settings.put({
    ...s,
    startingWeights: { ...s.startingWeights, [exerciseId]: kg },
  });
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const s = await getSettings();
  await db.settings.put({ ...s, ...patch });
}

/** Log a bodyweight measurement and update the current bodyweight setting. */
export async function addBodyweight(weightKg: number, when = new Date()): Promise<void> {
  await db.bodyweight.put({
    id: crypto.randomUUID(),
    date: when.toISOString(),
    weightKg,
  });
  await updateSettings({ bodyweightKg: weightKg });
}

// --- Exercise customization ------------------------------------------------

export async function setPatternSelection(patternKey: string, exerciseId: string): Promise<void> {
  const s = await getSettings();
  await db.settings.put({
    ...s,
    patternSelections: { ...s.patternSelections, [patternKey]: exerciseId },
  });
}

/** Clear a swap so the pattern follows the block's rotation default again. */
export async function clearPatternSelection(patternKey: string): Promise<void> {
  const s = await getSettings();
  const next = { ...s.patternSelections };
  delete next[patternKey];
  await db.settings.put({ ...s, patternSelections: next });
}

export async function setPatternDisabled(patternKey: string, disabled: boolean): Promise<void> {
  const s = await getSettings();
  const set = new Set(s.disabledPatterns);
  if (disabled) set.add(patternKey);
  else set.delete(patternKey);
  await db.settings.put({ ...s, disabledPatterns: [...set] });
}

export async function setRestOverride(exerciseId: string, seconds: number | null): Promise<void> {
  const s = await getSettings();
  const next = { ...s.restOverrides };
  if (seconds === null) delete next[exerciseId];
  else next[exerciseId] = seconds;
  await db.settings.put({ ...s, restOverrides: next });
}

// --- Mesocycle controls ----------------------------------------------------

/** Restart the current block from week 1 (history is kept). */
export async function resetBlock(): Promise<void> {
  const cycle = await db.cycleState.get("current");
  if (!cycle) return;
  await db.cycleState.put({
    ...cycle,
    week: 1,
    nextDayType: "upper",
    completedSessions: 0,
  });
}

/** Roll into the next block now, rotating accessories (history is kept). */
export async function startNextBlock(): Promise<void> {
  await db.transaction("rw", db.cycleState, db.mesocycles, async () => {
    const cycle = await db.cycleState.get("current");
    if (!cycle) return;
    const meso = await db.mesocycles.get(cycle.mesocycleId);
    const nextBlock = (meso?.blockNumber ?? 1) + 1;
    const newMeso = createMesocycle(nextBlock);
    await db.mesocycles.put(newMeso);
    await db.cycleState.put({
      id: "current",
      mesocycleId: newMeso.id,
      week: 1,
      nextDayType: "upper",
      completedSessions: 0,
    });
  });
}

// --- Backup / restore ------------------------------------------------------

const TABLE_NAMES = [
  "settings",
  "cycleState",
  "mesocycles",
  "workouts",
  "bodyweight",
  "protein",
] as const;

export interface BackupFile {
  app: "hypertrophy";
  version: number;
  exportedAt: string;
  data: Record<string, unknown[]>;
}

export async function exportData(): Promise<BackupFile> {
  const entries = await Promise.all(TABLE_NAMES.map((name) => db.table(name).toArray()));
  const data: Record<string, unknown[]> = {};
  TABLE_NAMES.forEach((name, i) => (data[name] = entries[i]));
  return { app: "hypertrophy", version: 3, exportedAt: new Date().toISOString(), data };
}

/** Backfill any Settings fields a (possibly older) backup is missing. */
function normalizeSettings(rows: unknown[]): unknown[] {
  return rows.map((row) => {
    const s = row as Partial<Settings>;
    return {
      ...s,
      startingWeights: s.startingWeights ?? {},
      restOverrides: s.restOverrides ?? {},
      patternSelections: s.patternSelections ?? {},
      disabledPatterns: s.disabledPatterns ?? [],
      rirEnabled: s.rirEnabled ?? true,
      stallDetection: s.stallDetection ?? true,
      stallWindow: s.stallWindow ?? 3,
    };
  });
}

export async function importData(payload: BackupFile): Promise<void> {
  const data = payload?.data;
  if (!data || typeof data !== "object") throw new Error("Invalid backup file.");
  await db.transaction("rw", TABLE_NAMES.map((n) => db.table(n)), async () => {
    for (const name of TABLE_NAMES) {
      let rows = data[name];
      const table = db.table(name);
      await table.clear();
      if (name === "settings" && Array.isArray(rows)) rows = normalizeSettings(rows);
      if (Array.isArray(rows) && rows.length) await table.bulkPut(rows);
    }
  });
}

/** Wipe everything; the app re-seeds a fresh Block 1 on next load. */
export async function eraseAllData(): Promise<void> {
  await db.transaction("rw", TABLE_NAMES.map((n) => db.table(n)), async () => {
    for (const name of TABLE_NAMES) await db.table(name).clear();
  });
}

// --- Workout session -------------------------------------------------------

/** Persist the in-progress session (draft) without advancing the cycle. */
export async function saveDraft(log: WorkoutLog): Promise<void> {
  await db.workouts.put(log);
}

export async function discardDraft(id: string): Promise<void> {
  await db.workouts.delete(id);
}

/**
 * Finalize a session: stamp completion, then advance the cycle position —
 * alternating upper/lower, ticking weeks, and rolling into a fresh (rotated)
 * mesocycle when the deload week wraps.
 */
export async function completeWorkout(log: WorkoutLog): Promise<void> {
  await db.transaction("rw", db.workouts, db.cycleState, db.mesocycles, async () => {
    await db.workouts.put({ ...log, completedAt: new Date().toISOString() });

    const cycle = await db.cycleState.get("current");
    if (!cycle) return;
    const meso = await db.mesocycles.get(cycle.mesocycleId);
    if (!meso) return;

    const next = advancePosition({
      week: cycle.week,
      nextDayType: cycle.nextDayType,
      completedSessions: cycle.completedSessions,
      blockNumber: meso.blockNumber,
    });

    let mesocycleId = cycle.mesocycleId;
    if (next.startNewBlock) {
      const newBlock = createMesocycle(meso.blockNumber + 1);
      await db.mesocycles.put(newBlock);
      mesocycleId = newBlock.id;
    }

    await db.cycleState.put({
      id: "current",
      mesocycleId,
      week: next.week,
      nextDayType: next.nextDayType,
      completedSessions: next.completedSessions,
    });
  });
}
