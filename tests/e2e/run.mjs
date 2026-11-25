// Runs every *.e2e.mjs suite in turn against the running stack (start it with: bash tests/e2e/start.sh).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const dir = import.meta.dirname;
const only = process.argv[2];
let failed = 0, passed = 0;
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".e2e.mjs") && (!only || f.includes(only))).sort()) {
  const run = spawnSync("node", [path.join(dir, file)], { encoding: "utf8", cwd: path.join(dir, "../..") });
  const out = (run.stdout ?? "") + (run.stderr ?? "");
  const p = (out.match(/^PASS /gm) ?? []).length, f = (out.match(/^FAIL /gm) ?? []).length;
  passed += p;
  if (f > 0 || run.status !== 0) { failed += 1; console.log(`FAIL ${file}: ${p} passed, ${f} failed`); console.log(out.split("\n").filter((l) => /^FAIL |Error|Timeout|violations/.test(l)).slice(0, 10).join("\n")); }
  else console.log(`ok   ${file}: ${p} checks`);
}
console.log(`\n${passed} checks passed${failed ? `, ${failed} suite(s) failed` : ""}`);
process.exit(failed ? 1 : 0);
