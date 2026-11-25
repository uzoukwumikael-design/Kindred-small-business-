/**
 * Saves every Kindling table to one file. Run it on your own machine, on a schedule you can keep up.
 *
 *   BACKUP_PASSPHRASE='a long passphrase you will not lose' SUPABASE_SERVICE_ROLE_KEY=... VITE_SUPABASE_URL=... npm run backup
 *
 * The file holds personal data (emails, saved weeks, messages people shared), so it is encrypted with your passphrase.
 * Without BACKUP_PASSPHRASE it refuses to write, unless you add --plain and accept an unencrypted file.
 * Keep the passphrase somewhere other than next to the backup. Lose it and the backup cannot be opened.
 * It does not copy Supabase's sign-in accounts. Those stay in Supabase.
 */
import fs from "node:fs";
import path from "node:path";
import { TABLES, seal, type Backup } from "./backup-lib.mts";

const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const passphrase = process.env.BACKUP_PASSPHRASE || "";
const plain = process.argv.includes("--plain");
const outDir = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : "backups";
if (!url || !key) { console.error("Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first."); process.exit(2); }
if (!passphrase && !plain) { console.error("Set BACKUP_PASSPHRASE, or add --plain to write an unencrypted file."); process.exit(2); }

async function all(table: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const response = await fetch(`${url}/rest/v1/${table}?select=*`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}`, "Range-Unit": "items" } });
    if (!response.ok) throw new Error(`${table}: HTTP ${response.status}`);
    const page = (await response.json()) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

const backup: Backup = { version: 1, createdAt: new Date().toISOString(), counts: {}, tables: {} };
for (const t of TABLES) {
  backup.tables[t.name] = await all(t.name);
  backup.counts[t.name] = backup.tables[t.name].length;
}
const stamp = backup.createdAt.replace(/[:.]/g, "-");
fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, `kindling-backup-${stamp}${passphrase ? ".enc" : ""}.json`);
fs.writeFileSync(file, JSON.stringify(passphrase ? seal(JSON.stringify(backup), passphrase) : backup), { mode: 0o600 });
console.log(`Saved ${file}`);
console.log(backup.counts);
if (!passphrase) console.log("WARNING: this file is not encrypted and contains personal data. Store it carefully.");
