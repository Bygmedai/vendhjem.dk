// Tiny HTTP-front for Workeren under test. Kun til smoke-hegn.sh.
// Samme stubs og migrationer som koer.mjs — ikke produktion.
import { createServer } from "node:http";
import { readdirSync, readFileSync } from "node:fs";
import { lavD1, lavR2, lavAssets } from "./stubs.mjs";

const dir = new URL("../migrations/", import.meta.url);
const sql = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(new URL(f, dir), "utf8"));

const worker = (await import("../src/index.js")).default;
const env = {
  FONDE_DB: lavD1(sql),
  FONDE_FILER: lavR2(),
  ASSETS: lavAssets(),
  LOKAL_TEST: "1",
  SESSION_NOEGLE: "test-session-noegle-32bytes-min!",
};

const aabent = await env.FONDE_DB.prepare(
  `SELECT id FROM ophold WHERE status = 'åben' ORDER BY start_dato LIMIT 1`
).first();
if (!aabent?.id) {
  console.error("smoke-hegn-server: ingen åbne ophold i stubben");
  process.exit(2);
}

const HOP = new Set(["connection", "keep-alive", "transfer-encoding", "content-length"]);

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://127.0.0.1`);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v == null || HOP.has(k.toLowerCase())) continue;
      if (Array.isArray(v)) for (const x of v) headers.append(k, x);
      else headers.set(k, v);
    }
    const init = { method: req.method || "GET", headers };
    if (req.method && req.method !== "GET" && req.method !== "HEAD") {
      const bidder = [];
      for await (const b of req) bidder.push(b);
      const buf = Buffer.concat(bidder);
      if (buf.length) init.body = new Uint8Array(buf);
    }
    const r = await worker.fetch(new Request(url, init), env, {});
    res.statusCode = r.status;
    for (const [k, v] of r.headers) {
      if (HOP.has(k.toLowerCase())) continue;
      res.appendHeader(k, v);
    }
    const krop = Buffer.from(await r.arrayBuffer());
    res.end(krop);
  } catch (e) {
    res.statusCode = 500;
    res.end(String(e && e.message || e));
  }
});

const port = Number(process.env.SMOKE_PORT || 0);
server.listen(port, "127.0.0.1", () => {
  const adr = server.address();
  process.stdout.write(`READY http://127.0.0.1:${adr.port} ${aabent.id}\n`);
});
