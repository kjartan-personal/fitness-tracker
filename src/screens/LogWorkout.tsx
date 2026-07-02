import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import RestTimer from "@/components/RestTimer";
import {
  useCycleState,
  useDraftWorkout,
  useSettings,
  useTodayPrescription,
} from "@/hooks/useAppData";
import { completeWorkout, discardDraft, saveDraft } from "@/db/actions";
import type { PrescribedExercise, WorkoutLog } from "@/types/models";

const RIR_OPTIONS = ["", "0", "1", "2", "3", "4"];

interface SetRow {
  weight: string;
  reps: string;
  rir: string;
  done: boolean;
}
interface ExState {
  exerciseId: string;
  sets: SetRow[];
}
interface RestState {
  total: number;
  endsAt: number;
  exerciseName: string;
}

export default function LogWorkout() {
  const navigate = useNavigate();
  const prescription = useTodayPrescription();
  const cycle = useCycleState();
  const settings = useSettings();
  const draft = useDraftWorkout(); // undefined = loading, null = none
  const rirEnabled = settings?.rirEnabled ?? true;

  const [grid, setGrid] = useState<ExState[] | null>(null);
  const [rest, setRest] = useState<RestState | null>(null);
  const initedRef = useRef(false);
  const workoutIdRef = useRef<string>("");
  const startedAtRef = useRef<string>("");

  // One-time initialization from the prescription, resuming a matching draft.
  useEffect(() => {
    if (initedRef.current) return;
    if (!prescription || !cycle || draft === undefined) return;

    const matches =
      draft &&
      draft.mesocycleId === cycle.mesocycleId &&
      draft.week === prescription.week &&
      draft.dayType === prescription.dayType;

    if (draft && !matches) discardDraft(draft.id);

    workoutIdRef.current = matches ? draft!.id : crypto.randomUUID();
    startedAtRef.current = matches ? draft!.date : new Date().toISOString();

    const next: ExState[] = prescription.exercises.map((ex) => {
      const done = matches
        ? draft!.entries.find((e) => e.exerciseId === ex.exercise.id)?.sets ?? []
        : [];
      const rows: SetRow[] = [];
      const count = Math.max(ex.targetSets, done.length);
      for (let i = 0; i < count; i++) {
        const d = done[i];
        rows.push(
          d
            ? {
                weight: String(d.weight),
                reps: String(d.reps),
                rir: d.rir != null ? String(d.rir) : "",
                done: true,
              }
            : {
                weight: ex.suggestedWeight ? String(ex.suggestedWeight) : "",
                reps: String(ex.repTarget),
                rir: "",
                done: false,
              },
        );
      }
      return { exerciseId: ex.exercise.id, sets: rows };
    });

    setGrid(next);
    initedRef.current = true;
  }, [prescription, cycle, draft]);

  const byId = useMemo(() => {
    const m: Record<string, PrescribedExercise> = {};
    prescription?.exercises.forEach((e) => (m[e.exercise.id] = e));
    return m;
  }, [prescription]);

  function buildLog(next: ExState[]): WorkoutLog {
    return {
      id: workoutIdRef.current,
      date: startedAtRef.current,
      dayType: prescription!.dayType,
      mesocycleId: cycle!.mesocycleId,
      blockNumber: prescription!.blockNumber,
      week: prescription!.week,
      entries: next
        .map((ex) => ({
          exerciseId: ex.exerciseId,
          sets: ex.sets
            .filter((s) => s.done)
            .map((s) => ({
              weight: Number(s.weight) || 0,
              reps: Number(s.reps) || 0,
              ...(s.rir !== "" ? { rir: Number(s.rir) } : {}),
            })),
        }))
        .filter((e) => e.sets.length > 0),
    };
  }

  function mutate(fn: (g: ExState[]) => ExState[], persist = true) {
    setGrid((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      if (persist) saveDraft(buildLog(next));
      return next;
    });
  }

  function setField(
    exIdx: number,
    setIdx: number,
    field: "weight" | "reps" | "rir",
    v: string,
    persist = false, // keystrokes don't persist; discrete picks (RIR) do
  ) {
    mutate(
      (g) =>
        g.map((ex, i) =>
          i !== exIdx
            ? ex
            : { ...ex, sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, [field]: v } : s)) },
        ),
      persist,
    );
  }

  function logSet(exIdx: number, setIdx: number) {
    const row = grid![exIdx].sets[setIdx];
    if (!row.reps || Number(row.reps) <= 0) return; // need reps to log
    mutate((g) =>
      g.map((ex, i) =>
        i !== exIdx
          ? ex
          : { ...ex, sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, done: true } : s)) },
      ),
    );
    // Auto-start rest timer.
    const presc = byId[grid![exIdx].exerciseId];
    if (presc) {
      setRest({
        total: presc.restSeconds,
        endsAt: Date.now() + presc.restSeconds * 1000,
        exerciseName: presc.exercise.name,
      });
    }
  }

  function editSet(exIdx: number, setIdx: number) {
    mutate((g) =>
      g.map((ex, i) =>
        i !== exIdx
          ? ex
          : { ...ex, sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, done: false } : s)) },
      ),
    );
  }

  function addSet(exIdx: number) {
    mutate((g) =>
      g.map((ex, i) => {
        if (i !== exIdx) return ex;
        const last = ex.sets[ex.sets.length - 1];
        const presc = byId[ex.exerciseId];
        return {
          ...ex,
          sets: [
            ...ex.sets,
            {
              weight: last?.weight ?? (presc ? String(presc.suggestedWeight) : ""),
              reps: presc ? String(presc.repTarget) : "",
              rir: "",
              done: false,
            },
          ],
        };
      }),
    );
  }

  function removeSet(exIdx: number, setIdx: number) {
    mutate((g) =>
      g.map((ex, i) =>
        i !== exIdx ? ex : { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) },
      ),
    );
  }

  async function finish() {
    if (!grid) return;
    const log = buildLog(grid);
    if (log.entries.length === 0) {
      navigate("/");
      return;
    }
    await completeWorkout(log);
    navigate("/");
  }

  if (!prescription || !cycle || !grid || !settings) {
    return (
      <div className="screen">
        <div className="muted center" style={{ marginTop: 40 }}>
          Loading session…
        </div>
      </div>
    );
  }

  const totalSets = grid.reduce((n, ex) => n + ex.sets.length, 0);
  const doneSets = grid.reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0);

  return (
    <div className="screen log-screen">
      <div className="screen-header">
        <h1>Log Workout</h1>
        <div className="subtitle">
          {prescription.dayType === "upper" ? "Upper" : "Lower"} · Block{" "}
          {prescription.blockNumber} · Week {prescription.week}/5
          {prescription.isDeload ? " · Deload" : ""} — {doneSets}/{totalSets} sets
        </div>
      </div>

      {grid.map((ex, exIdx) => {
        const presc = byId[ex.exerciseId];
        if (!presc) return null;
        const [minR, maxR] = presc.repRange;
        const doneRows = ex.sets.filter((s) => s.done);
        const clearedTop =
          doneRows.length >= presc.targetSets && doneRows.every((s) => Number(s.reps) >= maxR);
        return (
          <div className="card" key={ex.exerciseId}>
            <div className="exercise-head">
              <div>
                <div className="name">{presc.exercise.name}</div>
                <div className="meta">
                  target {presc.targetSets} × {minR}–{maxR}
                  {rirEnabled ? ` @ ${presc.targetRir} RIR` : ""}
                  {presc.last ? ` · last ${presc.last.weight}kg × ${presc.last.reps.join(", ")}` : ""}
                </div>
              </div>
              {doneRows.length > 0 && (
                <span className={`pill ${clearedTop ? "good" : "accent"}`}>
                  {clearedTop ? "top range ✓" : `${doneRows.length}/${presc.targetSets}`}
                </span>
              )}
            </div>

            <div className="sets">
              {ex.sets.map((s, setIdx) => (
                <div className={`set-row ${s.done ? "done" : ""}`} key={setIdx}>
                  <span className="set-idx">{setIdx + 1}</span>
                  <input
                    className="set-input"
                    inputMode="decimal"
                    value={s.weight}
                    placeholder="kg"
                    disabled={s.done}
                    onChange={(e) => setField(exIdx, setIdx, "weight", e.target.value)}
                  />
                  <span className="unit">kg</span>
                  <input
                    className="set-input"
                    inputMode="numeric"
                    value={s.reps}
                    placeholder="reps"
                    disabled={s.done}
                    onChange={(e) => setField(exIdx, setIdx, "reps", e.target.value)}
                  />
                  <span className="unit">reps</span>
                  {rirEnabled && (
                    <select
                      className="rir-select"
                      value={s.rir}
                      disabled={s.done}
                      onChange={(e) => setField(exIdx, setIdx, "rir", e.target.value, true)}
                      title="Reps in reserve"
                    >
                      {RIR_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o === "" ? "RIR" : o === "4" ? "4+" : o}
                        </option>
                      ))}
                    </select>
                  )}
                  {s.done ? (
                    <button className="set-btn edit" onClick={() => editSet(exIdx, setIdx)}>
                      Edit
                    </button>
                  ) : (
                    <button className="set-btn log" onClick={() => logSet(exIdx, setIdx)}>
                      ✓
                    </button>
                  )}
                  <button className="set-btn remove" onClick={() => removeSet(exIdx, setIdx)}>
                    ×
                  </button>
                </div>
              ))}
            </div>

            <button className="add-set" onClick={() => addSet(exIdx)}>
              + Add set
            </button>
          </div>
        );
      })}

      <div style={{ height: 8 }} />
      <button className="btn" onClick={finish}>
        Finish Workout ✓
      </button>
      <button
        className="btn ghost"
        style={{ marginTop: 8 }}
        onClick={() => navigate("/")}
      >
        Save & exit
      </button>

      {rest && (
        <RestTimer
          total={rest.total}
          endsAt={rest.endsAt}
          exerciseName={rest.exerciseName}
          onExpire={() => setRest(null)}
          onSkip={() => setRest(null)}
          onAdjust={(delta) =>
            setRest((r) => (r ? { ...r, endsAt: r.endsAt + delta * 1000 } : r))
          }
        />
      )}
    </div>
  );
}
