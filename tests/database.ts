import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
export function database() {
  const sql = new DatabaseSync(":memory:");
  for (const file of [
    "0001_initial.sql",
    "0002_payment_cap.sql",
    "0003_receipt_reference.sql",
    "0004_password_auth.sql",
  ])
    sql.exec(
      readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"),
    );
  class Statement {
    values: unknown[] = [];
    constructor(public query: string) {}
    bind(...v: unknown[]) {
      this.values = v;
      return this;
    }
    async first() {
      return sql.prepare(this.query).get(...(this.values as any[])) || null;
    }
    async all() {
      return {
        results: sql.prepare(this.query).all(...(this.values as any[])),
      };
    }
    async run() {
      const r = sql.prepare(this.query).run(...(this.values as any[]));
      return { meta: { changes: Number(r.changes) }, success: true };
    }
  }
  return {
    sql,
    binding: {
      prepare: (s: string) => new Statement(s),
      batch: async (s: Statement[]) => {
        sql.exec("BEGIN");
        try {
          const out = [];
          for (const item of s) out.push(await item.run());
          sql.exec("COMMIT");
          return out;
        } catch (e) {
          sql.exec("ROLLBACK");
          throw e;
        }
      },
    } as unknown as D1Database,
  };
}
