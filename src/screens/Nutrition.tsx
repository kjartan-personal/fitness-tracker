import { useState } from "react";
import ProteinRing from "@/components/ProteinRing";
import { useProteinToday, useSettings } from "@/hooks/useAppData";
import { addProtein, setAteWell } from "@/db/actions";

export default function Nutrition() {
  const settings = useSettings();
  const protein = useProteinToday();
  const [custom, setCustom] = useState("");

  if (!settings) return <div className="screen" />;

  const target = Math.round(settings.bodyweightKg * settings.proteinPerKg);
  const surplusHint = Math.round(settings.bodyweightKg * 34); // ~lean-gain kcal guidance

  const addCustom = () => {
    const g = parseFloat(custom);
    if (!Number.isNaN(g) && g !== 0) {
      addProtein(g);
      setCustom("");
    }
  };

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Nutrition</h1>
        <div className="subtitle">Protein-first tracking</div>
      </div>

      <div className="card">
        <div className="ring-wrap">
          <ProteinRing grams={protein.grams} target={target} size={104} />
          <div style={{ flex: 1 }}>
            <div className="big" style={{ fontSize: 26, fontWeight: 800 }}>
              {Math.round(protein.grams)} / {target}g
            </div>
            <div className="small muted" style={{ fontSize: 13, marginTop: 4 }}>
              {settings.proteinPerKg} g/kg × {settings.bodyweightKg} kg
            </div>
          </div>
        </div>

        <div className="quick-add" style={{ marginTop: 14 }}>
          {[20, 25, 30, 40].map((g) => (
            <button key={g} onClick={() => addProtein(g)}>
              +{g}g
            </button>
          ))}
        </div>

        <div className="row" style={{ marginTop: 8 }}>
          <input
            inputMode="decimal"
            placeholder="custom g"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustom()}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--text)",
            }}
          />
          <button className="btn secondary" style={{ width: "auto", padding: "12px 18px" }} onClick={addCustom}>
            Add
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Ate well today?</div>
        <div className="row">
          <button
            className={`btn ${protein.ateWell === true ? "" : "secondary"}`}
            onClick={() => setAteWell(true)}
          >
            👍 Yes
          </button>
          <button
            className={`btn ${protein.ateWell === false ? "" : "secondary"}`}
            onClick={() => setAteWell(false)}
          >
            👎 No
          </button>
        </div>
      </div>

      <div className="card muted" style={{ fontSize: 13 }}>
        Calorie guidance (optional): a modest surplus of roughly{" "}
        <strong style={{ color: "var(--text)" }}>{surplusHint} kcal/day</strong> supports
        lean muscle gain. Protein is the primary tracked metric.
      </div>
    </div>
  );
}
