/**
 * Puts rows from a backup file back into Supabase. It does a DRY RUN by default and only prints what it would do.
 *
 *   npm run restore -- backups/kindling-backup-....enc.json                 shows the plan
 *   I_UNDERSTAND_THIS_OVERWRITES_ROWS=yes npm run restore -- <file> --apply  writes the rows
 *
 * Rows are merged by primary key, so rows with the same key are overwritten with the backup's version and other rows are left alone.
 * It restores into the SAME Supabase project. Rows point at sign-in accounts, so accounts that were deleted cannot come back.
 * Set BACKUP_PASSPHRASE if the file is encrypted.
 */
import fs from "node:fs";
import { applyRestore, isSealed, planRestore, unseal, type Backup } from "./backup-lib.mts";

const file = process.argv[2];
const apply = process.argv.includes("--apply");
if (!file || file.startsWith("--")) { console.error("Usage: npm run restore -- <backup file> [--apply]"); process.exit(2); }
const raw = JSON.parse(fs.readFileSync(file, "utf8"));
let backup: Backup;
if (isSealed(raw)) {
  if (!process.env.BACKUP_PASSPHRASE) { console.error("This backup is encrypted. Set BACKUP_PASSPHRASE."); process.exit(2); }
  try { backup = JSON.parse(unseal(raw, process.env.BACKUP_PASSPHRASE)); } catch { console.error("Could not open the backup: wrong passphrase, or the file has been changed."); process.exit(2); }
} else {
  backup = raw as Backup;
}
console.log(`Backup made ${backup.createdAt}`);
for (const step of planRestore(backup)) console.log(` ${step.table}: ${step.rows} rows in ${step.batches} batch(es), merged on ${step.conflict}`);
if (!apply) { console.log("\nDry run. Nothing was written. Add --apply to restore."); process.exit(0); }
if (process.env.I_UNDERSTAND_THIS_OVERWRITES_ROWS !== "yes") { console.error("Set I_UNDERSTAND_THIS_OVERWRITES_ROWS=yes to confirm."); process.exit(2); }
const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!url || !key) { console.error("Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first."); process.exit(2); }
const result = await applyRestore(backup, url, key);
console.log("\nRestored:", result.restored);
if (result.errors.length) { console.log("Problems:"); for (const e of result.errors) console.log(" -", e); process.exit(1); }
