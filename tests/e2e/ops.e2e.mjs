// The owner's tools: backup (encrypted by default) and restore (dry run by default), run for real against the stand-in database.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ok, results } from "./helpers.mjs";

const root = path.join(import.meta.dirname, "../..");
const out = fs.mkdtempSync(path.join(os.tmpdir(), "kindling-ops-"));
const env = { ...process.env, VITE_SUPABASE_URL: "http://127.0.0.1:9913", SUPABASE_SERVICE_ROLE_KEY: "svc" };
const run = (script, args, extra = {}) => spawnSync("npx", ["tsx", script, ...args], { cwd: root, encoding: "utf8", env: { ...env, ...extra } });

let r = run("scripts/backup.mts", ["--out", out], { BACKUP_PASSPHRASE: "" });
ok("a backup will not write personal data unencrypted by accident", r.status === 2 && r.stderr.includes("BACKUP_PASSPHRASE"));
r = run("scripts/backup.mts", ["--out", out], { BACKUP_PASSPHRASE: "a long passphrase for the test" });
const files = fs.readdirSync(out);
ok("an encrypted backup is written", r.status === 0 && files.length === 1 && files[0].endsWith(".enc.json"));
ok("it reports a count for every table, not the contents", /kindling_state/.test(r.stdout) && /kindling_event_counts/.test(r.stdout));
const raw = JSON.parse(fs.readFileSync(path.join(out, files[0]), "utf8"));
ok("the file is sealed, not readable", raw.sealed === true && !JSON.stringify(raw).includes("kindling_state"));
ok("only the owner can read the file on this machine", (fs.statSync(path.join(out, files[0])).mode & 0o077) === 0);
r = run("scripts/restore.mts", [path.join(out, files[0])], { BACKUP_PASSPHRASE: "a long passphrase for the test" });
ok("restore opens it and shows a dry run", r.status === 0 && r.stdout.includes("Dry run. Nothing was written.") && r.stdout.includes("kindling_state: 0 rows"));
r = run("scripts/restore.mts", [path.join(out, files[0])], { BACKUP_PASSPHRASE: "the wrong one" });
ok("the wrong passphrase is refused clearly", r.status === 2 && r.stderr.includes("wrong passphrase"));
r = run("scripts/restore.mts", [path.join(out, files[0]), "--apply"], { BACKUP_PASSPHRASE: "a long passphrase for the test" });
ok("writing needs an explicit confirmation", r.status === 2 && r.stderr.includes("I_UNDERSTAND_THIS_OVERWRITES_ROWS"));
r = run("scripts/restore.mts", [path.join(out, files[0]), "--apply"], { BACKUP_PASSPHRASE: "a long passphrase for the test", I_UNDERSTAND_THIS_OVERWRITES_ROWS: "yes" });
ok("a confirmed restore of an empty backup runs without error", r.status === 0 && r.stdout.includes("Restored:"));
r = run("scripts/backup.mts", ["--out", out, "--plain"], { BACKUP_PASSPHRASE: "" });
ok("--plain writes an unencrypted file and warns", r.status === 0 && r.stdout.includes("WARNING: this file is not encrypted"));
r = spawnSync("npx", ["tsx", "scripts/backup.mts", "--out", out], { cwd: root, encoding: "utf8", env: { ...env, VITE_SUPABASE_URL: "http://127.0.0.1:1", BACKUP_PASSPHRASE: "x" } });
ok("an unreachable database fails loudly instead of writing an empty backup", r.status !== 0 && fs.readdirSync(out).length === 2);
fs.rmSync(out, { recursive: true, force: true });
console.log(`\n${results.pass} passed, ${results.fail} failed`);
process.exitCode = results.fail ? 1 : 0;
