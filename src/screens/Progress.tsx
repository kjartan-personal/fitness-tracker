import { useMemo, useState } from "react";
import Sparkline from "@/components/Sparkline";
import {
  useBodyweightLog,
  useCycleState,
  useProteinLog,
  useSettings,
  useWorkoutHistory,
} from "@/hooks/useAppData";
import { addBodyweight } from "@/db/actions";
import {
  bodyweightSeries,
  exerciseSeries,
  exercisesWithHistory,
  muscleVolumeByWeek,
  proteinAdherence,
} from "@/engine/analytics";
import { MUSCLE_GROUPS } from "@/data/catalog";
import { WEEKS_PER_BLOCK, DELOAD_WEEK } from "@/engine/mesocycle";
import { fmtDate } from "@/engine/dates";

export default function Progress() {
  const cycle = useCycleState();
  const history = useWorkoutHistory();
  const bodyweight = useBodyweightLog();
  const proteinDays = useProteinLog();
  const settings = useSettings();

  if (!settings || history === undefined) {
    return (
      <div className="screen">
        <div className="muted center" style={{ marginTop: 40 }}>
          Loading…
        </div>
      </div>
    );
  }

  const proteinTarget = Math.round(settings.bodyweightKg * settings.proteinPerKg);

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Progress</h1>
        <div className="subtitle">Trends & mesocycle status</div>
      </div>

      {cycle && <MesocycleCard week={cycle.week} block={cycle.mesocycleId} sessions={cycle.completedSessions} nextDay={cycle.nextDayType} />}

      <WeeklyVolumeCard history={history} />

      <ExerciseTrends history={history} />

      <BodyweightCard entries={bodyweight ?? []} current={settings.bodyweightKg} />

      <ProteinAdherenceCard days={proteinDays ?? []} target={proteinTarget} />
    </div>
  );
}

// --- Mesocycle overview ----------------------------------------------------

function MesocycleCard({
  week,
  block,
  sessions,
  nextDay,
}: {
  week: number;
  block: string;
  sessions: number;
  nextDay: "upper" | "lower";
}) {
  const blockNum = block.replace("block-", "");
  return (
    <div className="card">
      <div className="card-title">Mesocycle · Block {blockNum}</div>
      <div className="week-strip">
        {Array.from({ length: WEEKS_PER_BLOCK }, (_, i) => i + 1).map((w) => {
          const isDeload = w === DELOAD_WEEK;
          const state = w < week ? "past" : w === week ? "current" : "future";
          return (
            <div key={w} className={`week-cell ${state} ${isDeload ? "deload" : ""}`}>
              <span className="wk">W{w}</span>
              <span className="wl">{isDeload ? "deload" : "accum"}</span>
            </div>
          );
        })}
      </div>
      <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>
        Week {week}/{WEEKS_PER_BLOCK} · next session: {nextDay} · {sessions} logged this block-run
      </div>
    </div>
  );
}

// --- Weekly volume per muscle ----------------------------------------------

function WeeklyVolumeCard({ history }: { history: NonNullable<ReturnType<typeof useWorkoutHistory>> }) {
  const weeks = useMemo(() => muscleVolumeByWeek(history, 2), [history]);
  const current = weeks[weeks.length - 1];
  const previous = weeks[weeks.length - 2];

  const rows = MUSCLE_GROUPS.map((mg) => ({
    mg,
    sets: current?.totals[mg] ?? 0,
    prev: previous?.totals[mg] ?? 0,
  })).sort((a, b) => b.sets - a.sets);

  const anyVolume = rows.some((r) => r.sets > 0);
  const scaleMax = Math.max(20, ...rows.map((r) => r.sets));

  const ws = new Date(current.weekStart);
  const we = new Date(ws);
  we.setDate(we.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Weekly volume</div>
        <span className="pill">
          {fmt(ws)} – {fmt(we)}
        </span>
      </div>
      <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
        Working sets per muscle this week · target ~10–20
      </div>

      {!anyVolume ? (
        <div className="muted" style={{ fontSize: 13 }}>
          No sets logged this week yet.
        </div>
      ) : (
        rows.map((r) => {
          const band = r.sets === 0 ? "zero" : r.sets < 10 ? "under" : r.sets <= 20 ? "good" : "over";
          const delta = r.sets - r.prev;
          return (
            <div className="vol-row" key={r.mg}>
              <span className="vol-label">{r.mg}</span>
              <div className="vol-track">
                <div className={`vol-fill ${band}`} style={{ width: `${(r.sets / scaleMax) * 100}%` }} />
              </div>
              <span className="vol-count">
                {r.sets}
                {previous && delta !== 0 && (
                  <span className={`vol-delta ${delta > 0 ? "up" : "down"}`}>
                    {delta > 0 ? "▲" : "▼"}{Math.abs(delta)}
                  </span>
                )}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}

// --- Per-exercise trends ---------------------------------------------------

function ExerciseTrends({ history }: { history: NonNullable<ReturnType<typeof useWorkoutHistory>> }) {
  const options = useMemo(() => exercisesWithHistory(history), [history]);
  const [selected, setSelected] = useState<string | null>(null);
  const active = selected ?? options[0]?.id ?? null;
  const series = useMemo(
    () => (active ? exerciseSeries(history, active) : []),
    [history, active],
  );

  if (options.length === 0) {
    return (
      <div className="card">
        <div className="card-title">Exercise trends</div>
        <div className="muted" style={{ fontSize: 13 }}>
          Log a workout to see estimated 1RM and volume trends here.
        </div>
      </div>
    );
  }

  const first = series[0];
  const last = series[series.length - 1];
  const delta = first && last ? Math.round((last.est1RM - first.est1RM) * 10) / 10 : 0;

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Exercise trends</div>
        <select
          className="select"
          value={active ?? ""}
          onChange={(e) => setSelected(e.target.value)}
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.sessions})
            </option>
          ))}
        </select>
      </div>

      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <span className="metric-big">{last?.est1RM ?? "—"}</span>
          <span className="metric-unit">kg est. 1RM</span>
        </div>
        {series.length > 1 && (
          <span className={`pill ${delta >= 0 ? "good" : "warn"}`}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}kg
          </span>
        )}
      </div>
      <Sparkline values={series.map((p) => p.est1RM)} />

      <div className="muted" style={{ fontSize: 12, margin: "12px 0 4px" }}>Volume per session (kg)</div>
      <Sparkline values={series.map((p) => p.volume)} color="var(--good)" height={44} />

      <div className="mini-log">
        {series.slice(-3).reverse().map((p) => (
          <div className="mini-row" key={p.date}>
            <span className="muted">{fmtDate(p.date)}</span>
            <span>
              {p.topWeight}kg × {p.topReps} · vol {p.volume}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Bodyweight ------------------------------------------------------------

function BodyweightCard({
  entries,
  current,
}: {
  entries: NonNullable<ReturnType<typeof useBodyweightLog>>;
  current: number;
}) {
  const [value, setValue] = useState("");
  const series = useMemo(() => bodyweightSeries(entries), [entries]);

  const commit = () => {
    const kg = parseFloat(value);
    if (!Number.isNaN(kg) && kg > 0) {
      addBodyweight(kg);
      setValue("");
    }
  };

  const first = series[0];
  const last = series[series.length - 1];
  const delta = first && last ? Math.round((last.weightKg - first.weightKg) * 10) / 10 : 0;
  const currentDisplay = last?.weightKg ?? current;

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Bodyweight</div>
        {series.length > 1 && (
          <span className={`pill ${delta >= 0 ? "accent" : "warn"}`}>
            {delta >= 0 ? "+" : ""}
            {delta}kg
          </span>
        )}
      </div>

      <div>
        <span className="metric-big">{currentDisplay}</span>
        <span className="metric-unit">kg current</span>
      </div>

      {series.length > 0 ? (
        <Sparkline values={series.map((p) => p.weightKg)} color="var(--warn)" />
      ) : (
        <div className="muted" style={{ fontSize: 13, margin: "6px 0" }}>
          No entries yet — log your weight to start the trend.
        </div>
      )}

      <div className="row" style={{ marginTop: 10 }}>
        <input
          className="text-input"
          inputMode="decimal"
          placeholder="e.g. 75.5"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commit()}
        />
        <button className="btn secondary" style={{ width: "auto", padding: "12px 18px" }} onClick={commit}>
          Log
        </button>
      </div>
    </div>
  );
}

// --- Protein adherence -----------------------------------------------------

function ProteinAdherenceCard({
  days,
  target,
}: {
  days: NonNullable<ReturnType<typeof useProteinLog>>;
  target: number;
}) {
  const { series, pct } = useMemo(() => proteinAdherence(days, target, 14), [days, target]);
  const maxGrams = Math.max(target, ...series.map((s) => s.grams), 1);

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Protein adherence</div>
        <span className={`pill ${pct >= 70 ? "good" : pct >= 40 ? "accent" : "warn"}`}>{pct}%</span>
      </div>
      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
        Last 14 days hitting {target}g target
      </div>
      <div className="adherence">
        {series.map((d) => (
          <div className="adh-col" key={d.date} title={`${d.date}: ${Math.round(d.grams)}g`}>
            <div className="adh-track">
              <div
                className={`adh-fill ${d.hit ? "hit" : d.hasData ? "miss" : "empty"}`}
                style={{ height: `${Math.min(100, (d.grams / maxGrams) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
