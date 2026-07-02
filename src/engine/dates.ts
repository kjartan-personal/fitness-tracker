/** YYYY-MM-DD key in local time, used for nutrition day records. */
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Whole days between two ISO dates (a - b), rounded down. */
export function daysBetween(aIso: string, bIso: string): number {
  const ms = new Date(aIso).getTime() - new Date(bIso).getTime();
  return Math.floor(ms / 86_400_000);
}
