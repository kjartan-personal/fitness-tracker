import { useEffect, useRef, useState } from "react";

interface Props {
  /** Original rest length in seconds (for the progress bar). */
  total: number;
  /** Epoch ms when rest ends. */
  endsAt: number;
  exerciseName: string;
  onExpire: () => void;
  onSkip: () => void;
  onAdjust: (deltaSeconds: number) => void;
}

function mmss(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Subtle end-of-rest alert: a short beep + a haptic buzz where supported. */
function alertRestOver() {
  try {
    navigator.vibrate?.([120, 60, 120]);
  } catch {
    /* ignore */
  }
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.42);
    osc.onended = () => ctx.close();
  } catch {
    /* audio not available */
  }
}

export default function RestTimer({
  total,
  endsAt,
  exerciseName,
  onExpire,
  onSkip,
  onAdjust,
}: Props) {
  const [now, setNow] = useState(Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  const remaining = (endsAt - now) / 1000;

  useEffect(() => {
    if (remaining <= 0 && !firedRef.current) {
      firedRef.current = true;
      alertRestOver();
      onExpire();
    }
  }, [remaining, onExpire]);

  const pct = Math.max(0, Math.min(1, remaining / total));

  return (
    <div className="rest-timer">
      <div className="rest-bar" style={{ width: `${pct * 100}%` }} />
      <div className="rest-inner">
        <div className="rest-info">
          <div className="rest-time">{mmss(remaining)}</div>
          <div className="rest-name">Rest · next: {exerciseName}</div>
        </div>
        <div className="rest-controls">
          <button onClick={() => onAdjust(-15)}>−15</button>
          <button onClick={() => onAdjust(15)}>+15</button>
          <button className="skip" onClick={onSkip}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
