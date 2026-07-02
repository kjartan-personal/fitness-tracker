import { useRef, useState } from "react";
import { EXERCISE_BY_ID, PATTERNS_BY_DAY } from "@/data/catalog";
import { useCurrentMesocycle, useSettings, useWorkoutHistory } from "@/hooks/useAppData";
import { backupStatus, type BackupStatus } from "@/engine/analytics";
import {
  clearPatternSelection,
  eraseAllData,
  exportData,
  importData,
  resetBlock,
  setPatternDisabled,
  setPatternSelection,
  setRestOverride,
  startNextBlock,
  updateSettings,
} from "@/db/actions";
import type { Mesocycle, Pattern, Settings as SettingsModel } from "@/types/models";

export default function Settings() {
  const settings = useSettings();
  const meso = useCurrentMesocycle();
  const workouts = useWorkoutHistory();
  if (!settings || !meso) return <div className="screen" />;

  const target = Math.round(settings.bodyweightKg * settings.proteinPerKg);
  const backup = backupStatus(workouts ?? [], settings.lastBackupAt);

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Settings</h1>
        <div className="subtitle">Body, exercises, data</div>
      </div>

      <div className="card">
        <div className="card-title">Body &amp; targets</div>
        <label className="field-label">Bodyweight (kg)</label>
        <input
          type="number"
          inputMode="decimal"
          className="text-input"
          style={{ width: "100%" }}
          value={settings.bodyweightKg}
          onChange={(e) => updateSettings({ bodyweightKg: parseFloat(e.target.value) || 0 })}
        />
        <label className="field-label" style={{ marginTop: 16 }}>
          Protein target: {settings.proteinPerKg.toFixed(1)} g/kg → {target}g/day
        </label>
        <input
          type="range"
          min={1.6}
          max={2.2}
          step={0.1}
          value={settings.proteinPerKg}
          onChange={(e) => updateSettings({ proteinPerKg: parseFloat(e.target.value) })}
          style={{ width: "100%" }}
        />
      </div>

      <TrainingCard settings={settings} />
      <ExercisesCard settings={settings} meso={meso} />
      <MesocycleCard />
      <BackupCard status={backup} />

      <div className="card muted" style={{ fontSize: 13 }}>
        Units: kg · Storage: on-device (IndexedDB). Personal use only — no account,
        no sync.
      </div>
    </div>
  );
}

// --- Training / autoregulation ---------------------------------------------

function TrainingCard({ settings }: { settings: SettingsModel }) {
  return (
    <div className="card">
      <div className="card-title">Training</div>

      <div className="toggle-row">
        <div>
          <div className="pattern-name">RIR targets</div>
          <div className="muted" style={{ fontSize: 12 }}>
            Per-week effort targets; log RIR to autoregulate load jumps.
          </div>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={settings.rirEnabled}
            onChange={(e) => updateSettings({ rirEnabled: e.target.checked })}
          />
          <span className="track" />
        </label>
      </div>

      <div className="toggle-row">
        <div>
          <div className="pattern-name">Plateau detection</div>
          <div className="muted" style={{ fontSize: 12 }}>
            Back off ~10% and suggest accessory swaps when a lift stalls.
          </div>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={settings.stallDetection}
            onChange={(e) => updateSettings({ stallDetection: e.target.checked })}
          />
          <span className="track" />
        </label>
      </div>

      {settings.stallDetection && (
        <div className="toggle-row">
          <div className="pattern-name">Stall after</div>
          <select
            className="select"
            style={{ maxWidth: 140 }}
            value={settings.stallWindow}
            onChange={(e) => updateSettings({ stallWindow: parseInt(e.target.value, 10) })}
          >
            <option value={2}>2 sessions</option>
            <option value={3}>3 sessions</option>
          </select>
        </div>
      )}
    </div>
  );
}

// --- Exercise swap / disable / rest ----------------------------------------

function ExercisesCard({ settings, meso }: { settings: SettingsModel; meso: Mesocycle }) {
  return (
    <div className="card">
      <div className="card-title">Exercises</div>
      <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
        Swap a movement, tweak its rest, or turn it off. Swaps persist across
        blocks; accessories still rotate unless you pin one.
      </div>
      {(["upper", "lower"] as const).map((day) => (
        <div key={day} style={{ marginBottom: 8 }}>
          <div className="day-label">{day === "upper" ? "Upper day" : "Lower day"}</div>
          {PATTERNS_BY_DAY[day].map((pattern) => (
            <PatternRow key={pattern.key} pattern={pattern} settings={settings} meso={meso} />
          ))}
        </div>
      ))}
    </div>
  );
}

function PatternRow({
  pattern,
  settings,
  meso,
}: {
  pattern: Pattern;
  settings: SettingsModel;
  meso: Mesocycle;
}) {
  const disabled = settings.disabledPatterns.includes(pattern.key);
  const options = [...(pattern.anchorId ? [pattern.anchorId] : []), ...pattern.poolIds];
  const rotationDefault = meso.selections[pattern.key];
  const pinned = settings.patternSelections[pattern.key];
  const selected = pinned ?? rotationDefault;
  const exercise = EXERCISE_BY_ID[selected];
  const restValue = settings.restOverrides[selected] ?? exercise?.restSeconds ?? 0;

  return (
    <div className={`pattern-row ${disabled ? "off" : ""}`}>
      <div className="pattern-top">
        <span className="pattern-name">{pattern.label}</span>
        <label className="switch">
          <input
            type="checkbox"
            checked={!disabled}
            onChange={(e) => setPatternDisabled(pattern.key, !e.target.checked)}
          />
          <span className="track" />
        </label>
      </div>
      {!disabled && (
        <div className="pattern-controls">
          <select
            className="select"
            value={selected}
            onChange={(e) =>
              e.target.value === rotationDefault
                ? clearPatternSelection(pattern.key)
                : setPatternSelection(pattern.key, e.target.value)
            }
          >
            {options.map((id) => (
              <option key={id} value={id}>
                {EXERCISE_BY_ID[id]?.name ?? id}
                {id === rotationDefault ? " (rotation)" : ""}
              </option>
            ))}
          </select>
          <div className="rest-field">
            <input
              type="number"
              inputMode="numeric"
              className="text-input rest-input"
              value={Math.round(restValue)}
              onChange={(e) =>
                setRestOverride(selected, Math.max(0, parseInt(e.target.value, 10) || 0))
              }
            />
            <span className="muted" style={{ fontSize: 12 }}>s rest</span>
          </div>
        </div>
      )}
      {pinned && !disabled && (
        <button className="link-btn" onClick={() => clearPatternSelection(pattern.key)}>
          ↺ follow rotation
        </button>
      )}
    </div>
  );
}

// --- Mesocycle controls ----------------------------------------------------

function MesocycleCard() {
  return (
    <div className="card">
      <div className="card-title">Mesocycle</div>
      <button
        className="btn secondary"
        onClick={() => {
          if (confirm("Restart the current block from Week 1? History is kept.")) resetBlock();
        }}
      >
        Reset current block to Week 1
      </button>
      <button
        className="btn secondary"
        style={{ marginTop: 8 }}
        onClick={() => {
          if (confirm("Start the next block now? Accessories rotate. History is kept."))
            startNextBlock();
        }}
      >
        Start next block (rotate accessories)
      </button>
    </div>
  );
}

// --- Backup / restore ------------------------------------------------------

function BackupCard({ status: backup }: { status: BackupStatus }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>("");

  async function handleExport() {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hypertrophy-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    await updateSettings({ lastBackupAt: data.exportedAt });
    setStatus("Exported ✓");
  }

  const lastLine = backup.neverBackedUp
    ? "Never backed up."
    : backup.daysSince === 0
      ? "Last backup: today."
      : `Last backup: ${backup.daysSince} day${backup.daysSince === 1 ? "" : "s"} ago.`;

  async function handleImportFile(file: File) {
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (payload?.app !== "hypertrophy") throw new Error("Not a Hypertrophy backup.");
      if (!confirm("Import will replace all current data. Continue?")) return;
      await importData(payload);
      setStatus("Imported ✓ reloading…");
      setTimeout(() => location.reload(), 500);
    } catch (err) {
      setStatus(`Import failed: ${(err as Error).message}`);
    }
  }

  return (
    <div className="card">
      <div className="card-title">Backup</div>
      {backup.stale && (
        <div className="nudge">
          ⚠️{" "}
          {backup.neverBackedUp
            ? `You've logged ${backup.unbacked} session${backup.unbacked === 1 ? "" : "s"} and never backed up. Export to keep your history safe.`
            : `${backup.unbacked} session${backup.unbacked === 1 ? "" : "s"} logged since your last backup — export to stay safe.`}
        </div>
      )}
      <button className="btn secondary" onClick={handleExport}>
        Export data (JSON)
      </button>
      <button
        className="btn secondary"
        style={{ marginTop: 8 }}
        onClick={() => fileRef.current?.click()}
      >
        Import from file
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImportFile(f);
          e.target.value = "";
        }}
      />
      <button
        className="btn danger-btn"
        style={{ marginTop: 8 }}
        onClick={() => {
          if (confirm("Erase ALL data and start fresh? This cannot be undone.")) {
            eraseAllData().then(() => location.reload());
          }
        }}
      >
        Erase all data
      </button>
      <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>
        {status || lastLine}
      </div>
    </div>
  );
}
