import type { LogEntry } from "@/lib/kindling/types";

/** Shared by the studio (browser) and the weekly email (server), so both always say the same thing. */

export function localDay(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function utcDay(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86_400_000);
}

export type WeekStats = {
  runs: number;
  saved: number;
  lastRuns: number;
  lastSaved: number;
  unmeasured: number;
};

export function weekStats(
  log: LogEntry[],
  baselines: Record<string, number>,
  today: string,
  keep: (entry: LogEntry) => boolean = () => true,
): WeekStats {
  const now = dayNumber(today);
  const mine = log.filter(keep);
  const measured = mine.filter((entry) => baselines[entry.workflowId] > 0);
  const within = (from: number, to: number) =>
    measured.filter((entry) => {
      const age = now - dayNumber(entry.day);
      return age >= from && age <= to;
    });
  const sum = (list: LogEntry[]) => list.reduce((total, entry) => total + (baselines[entry.workflowId] - entry.minutes), 0);
  const thisWeek = within(0, 6);
  const lastWeek = within(7, 13);
  return {
    runs: thisWeek.length,
    saved: sum(thisWeek),
    lastRuns: lastWeek.length,
    lastSaved: sum(lastWeek),
    unmeasured: mine.length - measured.length,
  };
}

export function span(minutes: number): string {
  const abs = Math.abs(minutes);
  const text = abs < 60 ? `${Math.round(abs)} minutes` : `${(abs / 60).toFixed(1)} hours`;
  return minutes < 0 ? `${text} more` : text;
}

export function summaryLines(stats: WeekStats, hourly: number): { line: string; trend: string } {
  const dollars = Math.round((Math.max(0, stats.saved) / 60) * hourly);
  const line =
    stats.runs === 0
      ? "This week: no timed runs yet."
      : `This week you ran it ${stats.runs} ${stats.runs === 1 ? "time" : "times"} and ${
          stats.saved >= 0 ? `got back ${span(stats.saved)}` : `spent ${span(-stats.saved)} more than before`
        }${stats.saved > 0 ? `, worth about $${dollars} at $${Math.round(hourly)} an hour` : ""}.`;
  const trend =
    stats.runs > 0 && stats.lastRuns > 0
      ? stats.saved >= stats.lastSaved
        ? ` That is ${span(stats.saved - stats.lastSaved)} more than the week before.`
        : ` The week before was ${span(stats.lastSaved - stats.saved)} better.`
      : "";
  return { line, trend };
}
