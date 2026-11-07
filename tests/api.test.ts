import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import worker, { type Env } from "../worker/index";
import { makeDemo } from "../shared/demo";
function database() {
  const sql = new DatabaseSync(":memory:");
  for (const file of [
    "0001_initial.sql",
    "0002_payment_cap.sql",
    "0003_receipt_reference.sql",
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
const origin = "https://dashboard.example.com";
test("demo API is explicit and does not accept server writes", async () => {
  const r = await worker.fetch(
    new Request(origin + "/api/bootstrap"),
    {} as Env,
  );
  const d = (await r.json()) as any;
  assert.equal(d.session.mode, "demo");
  assert.equal(d.workspace.projects.length, 6);
  assert.equal(
    (
      await worker.fetch(
        new Request(origin + "/api/receipts", { method: "POST" }),
        {} as Env,
      )
    ).status,
    409,
  );
});
test("live mode fails closed without configuration or valid JWT", async () => {
  assert.equal(
    (
      await worker.fetch(new Request(origin + "/api/bootstrap"), {
        APP_MODE: "live",
      } as Env)
    ).status,
    503,
  );
  const env = {
    APP_MODE: "live",
    DB: {} as D1Database,
    CF_ACCESS_TEAM_DOMAIN: "test-team.cloudflareaccess.com",
    CF_ACCESS_AUD: "aud",
    ADMIN_EMAIL: "admin@example.com",
  };
  assert.equal(
    (await worker.fetch(new Request(origin + "/api/bootstrap"), env)).status,
    401,
  );
  assert.equal(
    (
      await worker.fetch(
        new Request(origin + "/api/bootstrap", {
          headers: { "Cf-Access-Jwt-Assertion": "forged" },
        }),
        env,
      )
    ).status,
    401,
  );
});
test("live API validates identity, enforces roles, project scope and transactional payment limits", async () => {
  const { sql, binding } = database();
  const w = makeDemo();
  for (const p of w.people)
    sql
      .prepare("INSERT INTO members VALUES (?,?,?)")
      .run(p.id, p.email, JSON.stringify(p));
  for (const p of w.projects)
    sql
      .prepare("INSERT INTO projects VALUES (?,?)")
      .run(p.id, JSON.stringify(p));
  for (const t of w.tasks)
    sql
      .prepare("INSERT INTO tasks VALUES (?,?,?)")
      .run(t.id, t.projectId, JSON.stringify(t));
  for (const t of w.terms)
    sql
      .prepare("INSERT INTO payment_terms VALUES (?,?,?)")
      .run(t.id, t.projectId, JSON.stringify(t));
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "test";
  jwk.alg = "RS256";
  const previous = globalThis.fetch;
  globalThis.fetch = async (input: any) => {
    if (String(input).includes("/cdn-cgi/access/certs"))
      return Response.json({ keys: [jwk] });
    throw Error("Unexpected external request");
  };
  const issuer = "https://api-test.cloudflareaccess.com";
  const env: Env = {
    DB: binding,
    APP_MODE: "live",
    CF_ACCESS_TEAM_DOMAIN: "api-test.cloudflareaccess.com",
    CF_ACCESS_AUD: "aud",
    ADMIN_EMAIL: "owner@example.com",
  };
  async function call(
    email: string,
    path: string,
    method = "GET",
    data?: unknown,
    sameOrigin = true,
  ) {
    const token = await new SignJWT({ email })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setIssuer(issuer)
      .setAudience("aud")
      .setExpirationTime("5m")
      .sign(privateKey);
    return worker.fetch(
      new Request(origin + "/api" + path, {
        method,
        headers: {
          "Cf-Access-Jwt-Assertion": token,
          "Content-Type": "application/json",
          Origin: sameOrigin ? origin : "https://other.example.com",
        },
        body: data ? JSON.stringify(data) : undefined,
      }),
      env,
    );
  }
  try {
    const staff = await call("nam@example.com", "/bootstrap");
    assert.equal(staff.status, 200);
    const d = (await staff.json()) as any;
    assert.equal(d.workspace.receipts.length, 0);
    assert.equal(d.workspace.projects[0].contract, 0);
    assert.equal(
      (await call("outsider@example.com", "/bootstrap")).status,
      403,
    );
    assert.equal(
      (await call("nam@example.com", "/receipts", "POST", {})).status,
      403,
    );
    assert.equal(
      (
        await call("minh@example.com", "/tasks/t1-0", "PATCH", {
          weight: 20,
          progress: 10,
          hours: 3,
          assigneeId: "minh",
          blockReason: "",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await call(
          "hung@example.com",
          "/settings",
          "PUT",
          { companyName: "Test", listMapping: {} },
          false,
        )
      ).status,
      403,
    );
    const receipt = {
      projectId: "p2",
      amount: 100000000,
      date: "2026-11-07",
      reference: "PT-TEST",
      note: "Test",
      termId: "term1",
    };
    assert.equal(
      (await call("ha@example.com", "/receipts", "POST", receipt)).status,
      201,
    );
    const term = JSON.parse(
      (
        sql
          .prepare("SELECT data FROM payment_terms WHERE id=?")
          .get("term1") as any
      ).data,
    );
    assert.equal(term.received, 100000000);
    assert.equal(
      (await call("ha@example.com", "/receipts", "POST", receipt)).status,
      409,
    );
    assert.equal(
      (
        await call("ha@example.com", "/receipts", "POST", {
          ...receipt,
          reference: "PT-TEST-2",
          amount: 200000000,
        })
      ).status,
      400,
    );
    assert.equal(
      (sql.prepare("SELECT count(*) AS n FROM receipts").get() as any).n,
      1,
    );
    assert.throws(
      () =>
        sql
          .prepare(
            "UPDATE payment_terms SET data=json_set(data,'$.received',999999999) WHERE id='term1'",
          )
          .run(),
      /payment exceeds/,
    );
    assert.equal((await call("owner@example.com", "/bootstrap")).status, 200);
    assert.equal(
      (sql.prepare("SELECT count(*) AS n FROM audit_log").get() as any).n,
      1,
    );
  } finally {
    globalThis.fetch = previous;
    sql.close();
  }
});
