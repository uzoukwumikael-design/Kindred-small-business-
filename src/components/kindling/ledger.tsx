import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { monthDollars } from "@/lib/kindling/engine";
import type { ResolvedWorkflow } from "@/lib/kindling/engine";
import { formatMoney } from "@/lib/kindling/format";
import { useCloud } from "@/lib/kindling/cloud";
import { useKindling } from "@/lib/kindling/store";
import { fieldClass, primaryClass } from "@/components/kindling/shell";

function localDay(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86_400_000);
}

function hoursText(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(minutes);
  if (abs < 60) return `${sign}${Math.round(abs)} min`;
  return `${sign}${(abs / 60).toFixed(1)} hrs`;
}

const TARGET_RUNS = 10;

export function LedgerPane({ primary, hourly }: { primary: ResolvedWorkflow; hourly: number }) {
  const baseline = useKindling((state) => state.baselines[primary.id]);
  const log = useKindling((state) => state.log);
  const setBaseline = useKindling((state) => state.setBaseline);
  const addLog = useKindling((state) => state.addLog);
  const removeLog = useKindling((state) => state.removeLog);
  const user = useCloud((state) => state.user);
  const workspace = useCloud((state) => state.workspace);
  const teams = useCloud((state) => state.teams);
  const me = user ? user.email.split("@")[0].slice(0, 40) : "";
  const inCrew = workspace.kind === "team";
  const iOwn = inCrew && teams.some((team) => team.id === workspace.id && team.ownerId === user?.id);

  const [baseText, setBaseText] = useState(baseline ? String(baseline) : "");
  const [minutesText, setMinutesText] = useState("");
  const [day, setDay] = useState(localDay());
  const [error, setError] = useState("");

  const entries = useMemo(
    () => log.filter((entry) => entry.workflowId === primary.id).sort((a, b) => a.day.localeCompare(b.day)),
    [log, primary.id],
  );

  const hasBaseline = typeof baseline === "number" && baseline > 0;
  const saved = entries.map((entry) => (hasBaseline ? baseline - entry.minutes : 0));
  const totalSaved = saved.reduce((sum, value) => sum + value, 0);
  const runs = entries.length;
  const avgMinutes = runs ? entries.reduce((sum, entry) => sum + entry.minutes, 0) / runs : 0;
  const spanDays = runs ? Math.max(7, dayNumber(entries[runs - 1].day) - dayNumber(entries[0].day) + 1) : 7;
  const weeklyMinutes = hasBaseline && runs ? (totalSaved / spanDays) * 7 : 0;
  const planWeekly = primary.minutes;
  const done = runs >= TARGET_RUNS || (runs >= 3 && spanDays >= 14);

  function saveBaseline(value: string) {
    setBaseText(value);
    const next = Number(value);
    if (Number.isFinite(next) && next > 0) setBaseline(primary.id, next);
  }

  function addRun() {
    const minutes = Number(minutesText);
    if (!hasBaseline) {
      setError("Fill in the first box before adding runs. It is what the other numbers are measured against.");
      return;
    }
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 600) {
      setError("Enter the minutes this run took, between 1 and 600.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      setError("Pick the day it happened.");
      return;
    }
    setError("");
    addLog(primary.id, minutes, day, inCrew ? me : undefined);
    setMinutesText("");
  }

  const recent = entries.slice(-14);
  const peak = Math.max(1, ...recent.map((entry) => Math.abs(hasBaseline ? baseline - entry.minutes : 0)));

  return (
    <div>
      <h2 className="font-display text-2xl font-medium text-ink">Time it for real</h2>
      <p className="mt-3 text-base leading-relaxed text-ink">{primary.measure}</p>
      <p className="mt-3 text-base leading-relaxed text-muted">
        Two numbers are enough. How long one run of this job took before, and how long each run takes now,
        checking included. After ten runs or two weeks you will know whether to keep it. Dropping it is a fair
        result.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-ink">Before the tool, one run usually took (minutes)</span>
          <input
            className={`${fieldClass} mt-2 tabular-nums`}
            inputMode="numeric"
            value={baseText}
            placeholder="15"
            onChange={(event) => saveBaseline(event.target.value.replace(/[^\d]/g, "").slice(0, 3))}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink">Your hourly rate</span>
          <input className={`${fieldClass} mt-2 tabular-nums`} value={formatMoney(hourly)} readOnly aria-readonly="true" />
        </label>
      </div>

      <div className="mt-6 rounded-xl border border-line bg-surface p-5">
        <p className="text-sm font-medium text-ink">Add a run</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block">
            <span className="text-sm text-muted">Minutes it took with the tool</span>
            <input
              className={`${fieldClass} mt-1 tabular-nums`}
              inputMode="numeric"
              value={minutesText}
              placeholder="6"
              onChange={(event) => setMinutesText(event.target.value.replace(/[^\d]/g, "").slice(0, 3))}
              onKeyDown={(event) => {
                if (event.key === "Enter") addRun();
              }}
            />
          </label>
          <label className="block">
            <span className="text-sm text-muted">Day</span>
            <input
              type="date"
              className={`${fieldClass} mt-1`}
              value={day}
              max={localDay()}
              onChange={(event) => setDay(event.target.value)}
            />
          </label>
          <button type="button" className={primaryClass} onClick={addRun}>
            Add run
          </button>
        </div>
        {error ? <p className="mt-3 text-sm leading-relaxed text-ember">{error}</p> : null}
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        <div className="bg-surface p-4">
          <dt className="text-sm text-muted">Runs logged</dt>
          <dd className="mt-1 font-display text-3xl tabular-nums text-ink">
            {runs}
            <span className="font-sans text-sm text-muted"> of {TARGET_RUNS}</span>
          </dd>
        </div>
        <div className="bg-surface p-4">
          <dt className="text-sm text-muted">Average run</dt>
          <dd className="mt-1 font-display text-3xl tabular-nums text-ink">{runs ? hoursText(avgMinutes) : "None yet"}</dd>
        </div>
        <div className="bg-surface p-4">
          <dt className="text-sm text-muted">Saved so far</dt>
          <dd className="mt-1 font-display text-3xl tabular-nums text-ember">
            {runs && hasBaseline ? hoursText(totalSaved) : "None yet"}
          </dd>
        </div>
        <div className="bg-surface p-4">
          <dt className="text-sm text-muted">Planning estimate</dt>
          <dd className="mt-1 font-display text-3xl tabular-nums text-ink">{hoursText(planWeekly)}</dd>
          <dd className="text-xs text-muted">per week</dd>
        </div>
      </dl>

      {runs >= 3 && hasBaseline ? (
        <p className="mt-4 text-base leading-relaxed text-ink">
          At this pace you are getting back about {hoursText(weeklyMinutes)} a week, roughly{" "}
          {formatMoney(monthDollars(Math.max(0, weeklyMinutes), hourly))} a month at your rate. The planning estimate
          for a shop like yours was {hoursText(planWeekly)} a week.
        </p>
      ) : (
        <p className="mt-4 text-sm text-muted">
          {runs >= TARGET_RUNS ? "" : `Log ${Math.max(0, 3 - runs)} more run${3 - runs === 1 ? "" : "s"} to see your own weekly number.`}
        </p>
      )}

      {done && hasBaseline ? (
        <div className="mt-4 rounded-xl border border-ember bg-ember-soft p-4">
          <p className="font-display text-xl text-ink">{totalSaved > 0 ? "Keep it." : "Drop it, or change the job."}</p>
          <p className="mt-1 text-base leading-relaxed text-ink">
            {totalSaved > 0
              ? `Across ${runs} runs it gave back ${hoursText(totalSaved)} after checking. Make it the official way, then try the next job in the queue.`
              : `Across ${runs} runs it did not give time back. That is a useful answer. Swap to a different job below instead of forcing this one.`}
          </p>
        </div>
      ) : null}

      {inCrew && hasBaseline ? <CrewBreakdown entries={entries} baseline={baseline} /> : null}

      {recent.length > 0 && hasBaseline ? (
        <div className="mt-6">
          <p className="text-sm font-medium text-ink">Minutes saved per run (last {recent.length})</p>
          <ul className="mt-3 grid gap-2">
            {recent.map((entry) => {
              const value = baseline - entry.minutes;
              const width = Math.max(4, Math.round((Math.abs(value) / peak) * 100));
              return (
                <li key={entry.id} className="grid grid-cols-[5.5rem_1fr_4.5rem_2.75rem] items-center gap-3 text-sm">
                  <span className="tabular-nums text-muted">
                    {entry.day}
                    {inCrew && entry.by ? <span className="block truncate text-xs">{entry.by}</span> : null}
                  </span>
                  <span className="h-3 rounded-full bg-line" aria-hidden="true">
                    <span
                      className={"block h-3 rounded-full " + (value >= 0 ? "bg-ink" : "bg-ember")}
                      style={{ width: `${width}%` }}
                    />
                  </span>
                  <span className={"tabular-nums " + (value >= 0 ? "text-ink" : "text-ember")}>
                    {value >= 0 ? "+" : ""}
                    {value} min
                  </span>
                  {!inCrew || iOwn || !entry.by || entry.by === me ? (
                  <button
                    type="button"
                    aria-label={`Remove the run on ${entry.day}`}
                    onClick={() => removeLog(entry.id)}
                    className="inline-flex size-11 items-center justify-center rounded-lg text-muted hover:bg-ember-soft hover:text-ink"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function CrewBreakdown({ entries, baseline }: { entries: { by?: string; minutes: number }[]; baseline: number }) {
  const people = new Map<string, { runs: number; saved: number }>();
  for (const entry of entries) {
    const who = entry.by || "Earlier runs";
    const row = people.get(who) ?? { runs: 0, saved: 0 };
    row.runs += 1;
    row.saved += baseline - entry.minutes;
    people.set(who, row);
  }
  if (people.size < 1) return null;
  const total = Array.from(people.values()).reduce((sum, row) => sum + row.saved, 0);
  return (
    <div className="mt-6 rounded-xl border border-line bg-surface p-5">
      <p className="text-sm font-medium text-ink">Crew total: {hoursText(total)} saved</p>
      <ul className="mt-3 grid gap-1 text-sm text-ink">
        {Array.from(people.entries()).map(([who, row]) => (
          <li key={who} className="flex justify-between gap-3">
            <span className="truncate">{who}</span>
            <span className="tabular-nums text-muted">
              {row.runs} {row.runs === 1 ? "run" : "runs"}, {hoursText(row.saved)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
