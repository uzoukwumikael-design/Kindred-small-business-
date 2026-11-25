import type { Fact, Intake, Learned, LogEntry, Shop } from "@/lib/kindling/types";

export type Snapshot = {
  shop: Shop;
  intake: Intake | null;
  checks: Record<string, boolean>;
  sharpened: Record<string, string>;
  drafts: Record<string, string>;
  baselines: Record<string, number>;
  log: LogEntry[];
  facts: Fact[];
  learned: Learned[];
  /** Ids the person deleted. Merging keeps them gone even if an out-of-date device still has them. */
  deleted: string[];
};

export const MAX_DELETED = 300;

/**
 * Combines this device's week with a newer copy saved from another device.
 * Logged runs, facts and saved examples are merged by id, and anything the person deleted stays deleted.
 * Ticks are combined. For everything else the person's current edit wins.
 */
export function mergeSnapshots(local: Snapshot, remote: Snapshot): Snapshot {
  const deleted = Array.from(new Set([...remote.deleted, ...local.deleted])).slice(-MAX_DELETED);
  const gone = new Set(deleted);

  const seen = new Map<string, LogEntry>();
  for (const entry of [...remote.log, ...local.log]) if (!gone.has(entry.id)) seen.set(entry.id, entry);
  const log = Array.from(seen.values())
    .sort((a, b) => a.day.localeCompare(b.day) || a.id.localeCompare(b.id))
    .slice(-200);

  const checks: Record<string, boolean> = { ...remote.checks };
  for (const [key, value] of Object.entries(local.checks)) checks[key] = Boolean(checks[key]) || value;

  const localFactIds = new Set(local.facts.map((fact) => fact.id));
  const facts = [...remote.facts.filter((fact) => !localFactIds.has(fact.id)), ...local.facts]
    .filter((fact) => !gone.has(fact.id))
    .slice(0, 20);

  const localLearnedIds = new Set(local.learned.map((item) => item.id));
  const learned = [...remote.learned.filter((item) => !localLearnedIds.has(item.id)), ...local.learned]
    .filter((item) => !gone.has(item.id))
    .slice(-8);

  return {
    shop: local.shop,
    facts,
    learned,
    deleted,
    intake: local.intake ?? remote.intake,
    checks,
    sharpened: { ...remote.sharpened, ...local.sharpened },
    drafts: { ...remote.drafts, ...local.drafts },
    baselines: { ...remote.baselines, ...local.baselines },
    log,
  };
}
