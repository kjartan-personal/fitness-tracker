import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ProteinRing from "@/components/ProteinRing";
import {
  useProteinToday,
  useSettings,
  useTodayPrescription,
  useWorkoutHistory,
} from "@/hooks/useAppData";
import { EXERCISE_BY_ID } from "@/data/catalog";
import { addProtein, setAteWell, setPatternSelection, setStartingWeight } from "@/db/actions";
import { dayKey, fmtDate } from "@/engine/dates";
import { backupStatus } from "@/engine/analytics";
import type { PrescribedExercise } from "@/types/models";

const NOTE_LABEL: Record<PrescribedExercise["note"], string> = {
  increase: "▲ heavier",
  add_reps: "+ reps",
  starting: "start",
  deload: "deload",
  too_easy: "▲▲ was easy",
  stall_backoff: "plateau ↓10%",
};

export default function Today() {
  const navigate = useNavigate();
  const settings = useSettings();
  const prescription = useTodayPrescription();
  const history = useWorkoutHistory();
  const protein = useProteinToday();

  if (!settings || !prescription || history === undefined) {
    return (
      <div className="screen">
        <div className="muted center" style={{ marginTop: 40 }}>
          Loading…
        </div>
      </div>
    );
  }

  const proteinTarget = Math.round(settings.bodyweightKg * settings.proteinPerKg);
  const completedToday = history.find(
    (w) => w.completedAt && dayKey(new Date(w.completedAt)) === dayKey(),
  );
  const backup = backupStatus(history, settings.lastBackupAt);

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Today</h1>
        <div className="subtitle">{fmtDate(new Date().toISOString())}</div>
      </div>

      {backup.stale && (
        <button className="backup-banner" onClick={() => navigate("/settings")}>
          <span>💾 Time to back up — {backup.unbacked} session{backup.unbacked === 1 ? "" : "s"} unsaved</span>
          <span className="chev">›</span>
        </button>
      )}

      {completedToday ? (
        <RestDayCard dayType={completedToday.dayType} />
      ) : (
        <WorkoutCard
          startingWeights={settings.startingWeights}
          prescription={prescription}
          rirEnabled={settings.rirEnabled ?? true}
          onStart={() => navigate("/log")}
        />
      )}

      <ProteinSection
        grams={protein.grams}
        target={proteinTarget}
        ateWell={protein.ateWell}
      />
    </div>
  );
}

function WorkoutCard({
  prescription,
  startingWeights,
  rirEnabled,
  onStart,
}: {
  prescription: NonNullable<ReturnType<typeof useTodayPrescription>>;
  startingWeights: Record<string, number>;
  rirEnabled: boolean;
  onStart: () => void;
}) {
  const { blockNumber, week, dayType, isDeload, projectedMinutes, overBudget, exercises } =
    prescription;

  return (
    <>
      <div className="card">
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          <span className="pill accent">Block {blockNumber}</span>
          <span className="pill">Week {week}/5</span>
          <span className="pill">{dayType === "upper" ? "Upper" : "Lower"} Day</span>
          {isDeload && <span className="pill warn">Deload</span>}
          <span className={`pill ${overBudget ? "warn" : "good"}`}>
            ~{projectedMinutes} min
          </span>
        </div>
        {overBudget && (
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Over the 45-min budget — consider trimming an accessory set.
          </div>
        )}
      </div>

      <div className="card">
        {exercises.map((ex) => (
          <ExerciseRow
            key={ex.exercise.id}
            ex={ex}
            rirEnabled={rirEnabled}
            needsStartWeight={startingWeights[ex.exercise.id] === undefined && !ex.last}
          />
        ))}
      </div>

      <button className="btn" onClick={onStart}>
        Start Workout →
      </button>
    </>
  );
}

function ExerciseRow({
  ex,
  rirEnabled,
  needsStartWeight,
}: {
  ex: PrescribedExercise;
  rirEnabled: boolean;
  needsStartWeight: boolean;
}) {
  return (
    <div className="exercise">
      <div>
        <div className="name">{ex.exercise.name}</div>
        <div className="meta">
          {ex.targetSets} × {ex.repRange[0]}–{ex.repRange[1]}
          {rirEnabled ? ` @ ${ex.targetRir} RIR` : ""} · rest{" "}
          {Math.round(ex.restSeconds / 15) * 15 === ex.restSeconds
            ? `${Math.floor(ex.restSeconds / 60)}:${String(ex.restSeconds % 60).padStart(2, "0")}`
            : `${ex.restSeconds}s`}
        </div>
        {ex.last ? (
          <div className="last">
            Last: {ex.last.weight}kg × {ex.last.reps.join(", ")}
          </div>
        ) : (
          <div className="last">No history yet</div>
        )}
        {ex.swapSuggestion && (
          <button
            className="swap-suggest"
            onClick={() => setPatternSelection(ex.patternKey, ex.swapSuggestion!)}
          >
            ⚠️ Stalled — swap to {EXERCISE_BY_ID[ex.swapSuggestion]?.name ?? "alternative"}?
          </button>
        )}
      </div>
      <div className="prescribe">
        {needsStartWeight ? (
          <StartWeightInput exerciseId={ex.exercise.id} />
        ) : (
          <>
            <div className="weight">{ex.suggestedWeight || "—"}kg</div>
            <div className="reps">
              target {ex.repTarget} reps{rirEnabled ? ` @ ${ex.targetRir} RIR` : ""}
            </div>
            <div
              className={`tag ${
                ex.note === "deload" || ex.note === "stall_backoff" ? "deload" : ""
              }`}
            >
              {NOTE_LABEL[ex.note]}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StartWeightInput({ exerciseId }: { exerciseId: string }) {
  const [value, setValue] = useState("");
  const commit = () => {
    const kg = parseFloat(value);
    if (!Number.isNaN(kg) && kg > 0) setStartingWeight(exerciseId, kg);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <input
        inputMode="decimal"
        placeholder="kg"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        style={{
          width: 72,
          textAlign: "right",
          padding: "8px 10px",
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
          color: "var(--text)",
        }}
      />
      <div className="reps">starting wt</div>
    </div>
  );
}

function RestDayCard({ dayType }: { dayType: "upper" | "lower" }) {
  return (
    <div className="card center" style={{ padding: "26px 16px" }}>
      <div style={{ fontSize: 40 }}>✅</div>
      <div style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>
        {dayType === "upper" ? "Upper" : "Lower"} day done
      </div>
      <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
        Rest and recover. Keep protein up — next session is on your other-day cadence.
      </div>
    </div>
  );
}

function ProteinSection({
  grams,
  target,
  ateWell,
}: {
  grams: number;
  target: number;
  ateWell?: boolean;
}) {
  return (
    <div className="card">
      <div className="ring-wrap">
        <ProteinRing grams={grams} target={target} />
        <div style={{ flex: 1 }}>
          <div className="ring-label">
            <div className="big">
              {Math.max(0, target - grams) > 0
                ? `${Math.round(target - grams)}g to go`
                : "Target hit 🎉"}
            </div>
            <div className="small">Protein · {target}g daily target</div>
          </div>
          <div className="quick-add" style={{ marginTop: 12 }}>
            {[20, 30, 40].map((g) => (
              <button key={g} onClick={() => addProtein(g)}>
                +{g}g
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="row" style={{ marginTop: 14, gap: 8 }}>
        <button
          className={`btn ${ateWell === true ? "" : "secondary"}`}
          style={{ padding: 10 }}
          onClick={() => setAteWell(true)}
        >
          👍 Ate well
        </button>
        <button
          className={`btn ${ateWell === false ? "" : "secondary"}`}
          style={{ padding: 10 }}
          onClick={() => setAteWell(false)}
        >
          👎 Off day
        </button>
      </div>
    </div>
  );
}
