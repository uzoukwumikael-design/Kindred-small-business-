// Puts the same security headers Vercel will add (from vercel.json) in front of the production preview, so the tests see what visitors see.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const cfg = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "../../vercel.json"), "utf8"));
const extra = {};
for (const rule of cfg.headers) if (rule.source === "/(.*)") for (const h of rule.headers) extra[h.key.toLowerCase()] = h.value.replace("https://*.supabase.co", "http://127.0.0.1:9913");
const api = Object.fromEntries((cfg.headers.find((r) => r.source === "/api/(.*)")?.headers ?? []).map((h) => [h.key.toLowerCase(), h.value]));
http.createServer((req, res) => {
  const up = http.request({ host: "127.0.0.1", port: 8081, path: req.url, method: req.method, headers: req.headers }, (r) => {
    res.writeHead(r.statusCode, { ...r.headers, ...extra, ...(req.url.startsWith("/api/") ? api : {}) });
    r.pipe(res);
  });
  up.on("error", () => { res.statusCode = 502; res.end("bad gateway"); });
  req.pipe(up);
}).listen(8090, "127.0.0.1");
