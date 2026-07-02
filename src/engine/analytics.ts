import { EXERCISE_BY_ID } from "@/data/catalog";
import { dayKey, daysBetween } from "./dates";
import type { BodyweightEntry, ProteinDay, WorkoutLog } from "@/types/models";

/** Epley estimated 1RM. */
export function epley1RM(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

export interface SessionPoint {
  date: string; // ISO of the session
  est1RM: number;
  volume: number; // Σ weight × reps
  topWeight: number;
  topReps: number;
}

/** All exercises that appear in completed history, with a session count. */
export function exercisesWithHistory(
  history: WorkoutLog[],
): { id: string; name: string; sessions: number }[] {
  const counts = new Map<string, number>();
  for (const w of history) {
    if (!w.completedAt) continue;
    for (const e of w.entries) {
      if (e.sets.length > 0) counts.set(e.exerciseId, (counts.get(e.exerciseId) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([id, sessions]) => ({ id, name: EXERCISE_BY_ID[id]?.name ?? id, sessions }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Per-session est-1RM and volume for one exercise, oldest → newest. */
export function exerciseSeries(history: WorkoutLog[], exerciseId: string): SessionPoint[] {
  const points: SessionPoint[] = [];
  for (const w of history) {
    if (!w.completedAt) continue;
    const entry = w.entries.find((e) => e.exerciseId === exerciseId);
    if (!entry || entry.sets.length === 0) continue;

    let est1RM = 0;
    let volume = 0;
    let topWeight = 0;
    let topReps = 0;
    for (const s of entry.sets) {
      volume += s.weight * s.reps;
      const e1 = epley1RM(s.weight, s.reps);
      if (e1 > est1RM) {
        est1RM = e1;
        topWeight = s.weight;
        topReps = s.reps;
      }
    }
    points.push({ date: w.date, est1RM: Math.round(est1RM * 10) / 10, volume, topWeight, topReps });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

export interface BodyweightPoint {
  date: string;
  weightKg: number;
}

export function bodyweightSeries(entries: BodyweightEntry[]): BodyweightPoint[] {
  return entries
    .map((e) => ({ date: e.date, weightKg: e.weightKg }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface AdherenceDay {
  date: string; // YYYY-MM-DD
  grams: number;
  hit: boolean;
  hasData: boolean;
}

/**
 * Protein adherence over the trailing `windowDays` calendar days.
 * `pct` is the share of days that met the target.
 */
export function proteinAdherence(
  days: ProteinDay[],
  target: number,
  windowDays = 14,
): { series: AdherenceDay[]; pct: number } {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const series: AdherenceDay[] = [];
  const today = new Date();
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = dayKey(d);
    const rec = byDate.get(key);
    const grams = rec?.grams ?? 0;
    series.push({ date: key, grams, hit: target > 0 && grams >= target, hasData: !!rec });
  }
  const hits = series.filter((s) => s.hit).length;
  return { series, pct: Math.round((hits / windowDays) * 100) };
}

/** Local Monday 00:00 of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const mondayOffset = (x.getDay() + 6) % 7; // Sun=6 … Mon=0
  x.setDate(x.getDate() - mondayOffset);
  return x;
}

export interface WeekVolume {
  weekStart: string; // ISO of the Monday
  totals: Record<string, number>; // muscle group -> working-set count
}

/**
 * Working sets per muscle group for each of the trailing `numWeeks` calendar
 * weeks (Mon–Sun), oldest → newest. A working set is any logged set with reps.
 */
export function muscleVolumeByWeek(workouts: WorkoutLog[], numWeeks: number): WeekVolume[] {
  const thisMonday = startOfWeek(new Date());
  const weeks: WeekVolume[] = [];
  for (let i = numWeeks - 1; i >= 0; i--) {
    const ws = new Date(thisMonday);
    ws.setDate(ws.getDate() - i * 7);
    weeks.push({ weekStart: ws.toISOString(), totals: {} });
  }

  for (const w of workouts) {
    if (!w.completedAt) continue;
    const ws = startOfWeek(new Date(w.date)).getTime();
    const bucket = weeks.find((b) => new Date(b.weekStart).getTime() === ws);
    if (!bucket) continue;
    for (const e of w.entries) {
      const mg = EXERCISE_BY_ID[e.exerciseId]?.muscleGroup;
      if (!mg) continue;
      bucket.totals[mg] = (bucket.totals[mg] ?? 0) + e.sets.filter((s) => s.reps > 0).length;
    }
  }
  return weeks;
}

export interface BackupStatus {
  /** Completed sessions logged since the last export. */
  unbacked: number;
  /** Whole days since the last export, or null if never backed up. */
  daysSince: number | null;
  neverBackedUp: boolean;
  /** Worth nudging the user to export. */
  stale: boolean;
}

/** Whether the local data is overdue for a backup export. */
export function backupStatus(workouts: WorkoutLog[], lastBackupAt?: string): BackupStatus {
  const completed = workouts.filter((w) => w.completedAt);
  const neverBackedUp = !lastBackupAt;
  const unbacked = neverBackedUp
    ? completed.length
    : completed.filter((w) => w.completedAt! > lastBackupAt!).length;
  const daysSince = lastBackupAt ? daysBetween(new Date().toISOString(), lastBackupAt) : null;
  const stale = unbacked >= 3 || (daysSince !== null && daysSince >= 14 && unbacked > 0);
  return { unbacked, daysSince, neverBackedUp, stale };
}
