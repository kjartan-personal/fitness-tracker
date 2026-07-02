import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/db";
import { buildPrescription } from "@/engine/prescription";
import { dayKey } from "@/engine/dates";
import type { Prescription } from "@/types/models";

export function useSettings() {
  return useLiveQuery(() => db.settings.get("settings"), []);
}

export function useCycleState() {
  return useLiveQuery(() => db.cycleState.get("current"), []);
}

/** The active mesocycle record (follows the current cycle state). */
export function useCurrentMesocycle() {
  return useLiveQuery(async () => {
    const cycle = await db.cycleState.get("current");
    if (!cycle) return undefined;
    return db.mesocycles.get(cycle.mesocycleId);
  }, []);
}

export function useWorkoutHistory() {
  return useLiveQuery(
    () => db.workouts.orderBy("date").reverse().toArray(),
    [],
  );
}

/**
 * The in-progress session if one exists, else `null`. Stays `undefined` only
 * while the query is still loading, so callers can tell the two apart.
 */
export function useDraftWorkout() {
  return useLiveQuery(
    () => db.workouts.filter((w) => !w.completedAt).first().then((w) => w ?? null),
    [],
  );
}

export function useBodyweightLog() {
  return useLiveQuery(() => db.bodyweight.orderBy("date").toArray(), []);
}

export function useProteinLog() {
  return useLiveQuery(() => db.protein.toArray(), []);
}

/** Today's protein day record (creates a zeroed default in memory if none). */
export function useProteinToday() {
  const key = dayKey();
  const record = useLiveQuery(() => db.protein.get(key), [key]);
  return record ?? { date: key, grams: 0, ateWell: undefined };
}

/**
 * The fully-assembled prescription for the current position, or `undefined`
 * while data is still loading.
 */
export function useTodayPrescription(): Prescription | undefined {
  const data = useLiveQuery(async () => {
    const cycle = await db.cycleState.get("current");
    const settings = await db.settings.get("settings");
    if (!cycle || !settings) return undefined;
    const meso = await db.mesocycles.get(cycle.mesocycleId);
    if (!meso) return undefined;
    // Only completed sessions inform progression; the live draft is excluded.
    const history = (await db.workouts.orderBy("date").reverse().toArray()).filter(
      (w) => w.completedAt,
    );
    return buildPrescription(cycle, meso, history, settings);
  }, []);
  return data ?? undefined;
}
