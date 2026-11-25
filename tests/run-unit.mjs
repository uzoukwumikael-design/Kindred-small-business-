// Runs every unit test in tests/unit with tsx and prints one line per file. Exits with an error if any check fails.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const dir = path.join(import.meta.dirname, "unit");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".test.mts")).sort();
let failed = 0;
let total = 0;
for (const file of files) {
  const run = spawnSync("npx", ["tsx", path.join(dir, file)], { encoding: "utf8", cwd: path.join(import.meta.dirname, "..") });
  const out = (run.stdout ?? "") + (run.stderr ?? "");
  const passes = (out.match(/^PASS /gm) ?? []).length;
  const fails = (out.match(/^FAIL /gm) ?? []).length;
  const crashed = run.status !== 0 && fails === 0; // stopped early without a failing line
  total += passes;
  if (fails > 0 || crashed) {
    failed += 1;
    console.log(`FAIL ${file}: ${passes} passed, ${fails} failed${crashed ? ", and it stopped early" : ""}`);
    console.log(out.split("\n").filter((l) => /^FAIL |Error|error/.test(l)).slice(0, 8).join("\n"));
  } else {
    console.log(`ok   ${file}: ${passes} checks`);
  }
}
console.log(`\n${total} checks passed in ${files.length} files${failed ? `, ${failed} file(s) failed` : ""}`);
process.exit(failed ? 1 : 0);
