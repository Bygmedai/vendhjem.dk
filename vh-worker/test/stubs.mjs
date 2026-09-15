// Stubs for D1 og R2, så hele Workeren kan køres i Node uden Cloudflare.
// SQLite er den rigtige motor (node:sqlite), så migrationerne og SQL'en
// afprøves som de er — ikke en efterligning.
import { DatabaseSync } from "node:sqlite";

export function lavD1(sqlFiler) {
  const db = new DatabaseSync(":memory:");
  for (const sql of sqlFiler) db.exec(sql);

  const bind = (stmt, args) => args.map((a) => (a === undefined ? null : a));

  function prepare(sql) {
    // D1 bruger nummererede pladsholdere (?1, ?2 …) og binder efter NUMMER.
    // node:sqlite binder anonyme ? efter POSITION. Oversætter vi naivt, ryger
    // argumenterne i forkert rækkefølge, når numrene ikke står i stigende orden
    // — fx «SET x = ?2 WHERE id = ?1». Den fejl fandt prøverne i S593, og den
    // var i stubben, ikke i appen. Derfor: omarranger efter forekomst.
    const raekkefoelge = [...sql.matchAll(/\?(\d+)/g)].map((m) => Number(m[1]));
    const n = sql.replace(/\?\d+/g, "?");
    let bundet = [];
    const api = {
      bind(...a) {
        const arg = bind(null, a);
        bundet = raekkefoelge.length ? raekkefoelge.map((i) => arg[i - 1]) : arg;
        return api;
      },
      async first() {
        const r = db.prepare(n).get(...bundet);
        return r === undefined ? null : r;
      },
      async all() { return { results: db.prepare(n).all(...bundet) }; },
      async run() { const r = db.prepare(n).run(...bundet); return { success: true, meta: r }; },
      _sql: n, _args: () => bundet,
    };
    return api;
  }

  return {
    prepare,
    async batch(stmts) {
      db.exec("BEGIN");
      try {
        const ud = [];
        for (const s of stmts) ud.push(await s.run());
        db.exec("COMMIT");
        return ud;
      } catch (e) { db.exec("ROLLBACK"); throw e; }
    },
    _raw: db,
  };
}

export function lavR2() {
  const m = new Map();
  return {
    async put(key, body, opts) { m.set(key, { body, opts }); return { key }; },
    async get(key) {
      if (!m.has(key)) return null;
      const v = m.get(key);
      return { body: v.body, arrayBuffer: async () => v.body };
    },
    _size: () => m.size,
  };
}

export function lavAssets() {
  return { async fetch() { return new Response("asset", { status: 200 }); } };
}
