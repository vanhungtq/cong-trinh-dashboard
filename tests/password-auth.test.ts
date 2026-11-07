import test from "node:test";
import assert from "node:assert/strict";
import worker, { type Env } from "../worker/index";
import { database } from "./database";
const origin = "https://dashboard.example.com";
test("password setup, sessions, RBAC, password reset and logout work without Access", async () => {
  const { sql, binding } = database();
  const env: Env = {
    DB: binding,
    APP_MODE: "live",
    AUTH_MODE: "password",
    ADMIN_EMAIL: "owner@example.com",
    ADMIN_SETUP_TOKEN: "secure-setup-token-for-tests-only-1234",
  };
  let cookie = "";
  async function call(
    path: string,
    method = "GET",
    data?: unknown,
    session = cookie,
    requestOrigin = origin,
  ) {
    return worker.fetch(
      new Request(origin + "/api" + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          Origin: requestOrigin,
          "CF-Connecting-IP": "127.0.0.1",
          ...(session ? { Cookie: session } : {}),
        },
        body: data ? JSON.stringify(data) : undefined,
      }),
      env,
    );
  }
  const takeCookie = (r: Response) =>
    r.headers.get("Set-Cookie")!.split(";")[0];
  try {
    assert.equal((await call("/bootstrap")).status, 401);
    assert.deepEqual(await (await call("/auth/status")).json(), {
      mode: "password",
      setupRequired: true,
      setupEnabled: true,
    });
    const setup = {
      name: "Owner",
      email: "owner@example.com",
      password: "StrongPassword123!",
      setupToken: env.ADMIN_SETUP_TOKEN,
    };
    assert.equal(
      (await call("/auth/setup", "POST", { ...setup, setupToken: "wrong" }))
        .status,
      403,
    );
    assert.equal(
      (await call("/auth/setup", "POST", { ...setup, password: "short" }))
        .status,
      400,
    );
    assert.equal(
      (await call("/auth/setup", "POST", setup, "", "https://evil.example.com"))
        .status,
      403,
    );
    const created = await call("/auth/setup", "POST", setup);
    assert.equal(created.status, 201);
    cookie = takeCookie(created);
    assert.match(
      created.headers.get("Set-Cookie")!,
      /Secure; HttpOnly; SameSite=Lax/,
    );
    assert.equal((await call("/auth/setup", "POST", setup)).status, 409);
    assert.equal((await call("/bootstrap")).status, 200);
    const stored = sql
      .prepare("SELECT password_hash FROM auth_credentials")
      .get() as any;
    assert.match(stored.password_hash, /^pbkdf2\$100000\$/);
    assert.ok(!stored.password_hash.includes(setup.password));
    const persisted = JSON.stringify(
      sql.prepare("SELECT * FROM auth_sessions").all(),
    );
    assert.ok(!persisted.includes(cookie.split("=")[1]));
    const adminId = (sql.prepare("SELECT id FROM members").get() as any).id;
    sql
      .prepare("INSERT INTO members VALUES (?,?,?)")
      .run(
        "staff",
        "staff@example.com",
        JSON.stringify({
          id: "staff",
          name: "Staff",
          email: "staff@example.com",
          role: "staff",
          discipline: "Kiến trúc",
          capacity: 40,
        }),
      );
    assert.equal(
      (
        await call("/auth/accounts/staff/password", "PUT", {
          password: "StaffPassword123!",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call("/auth/login", "POST", {
          email: "staff@example.com",
          password: "wrong",
        })
      ).status,
      401,
    );
    const staffLogin = await call("/auth/login", "POST", {
      email: "STAFF@example.com",
      password: "StaffPassword123!",
    });
    assert.equal(staffLogin.status, 200);
    const staffCookie = takeCookie(staffLogin);
    assert.equal(
      (await call("/auth/accounts", "GET", undefined, staffCookie)).status,
      403,
    );
    assert.equal(
      (await call("/trello/workspaces", "GET", undefined, staffCookie)).status,
      403,
    );
    assert.equal(
      (
        await call(
          "/auth/password",
          "PUT",
          { currentPassword: "wrong", password: "NewStaffPassword123!" },
          staffCookie,
        )
      ).status,
      400,
    );
    const changed = await call(
      "/auth/password",
      "PUT",
      {
        currentPassword: "StaffPassword123!",
        password: "NewStaffPassword123!",
      },
      staffCookie,
    );
    assert.equal(changed.status, 200);
    assert.equal(
      (await call("/bootstrap", "GET", undefined, staffCookie)).status,
      401,
    );
    assert.equal(
      (await call("/bootstrap", "GET", undefined, takeCookie(changed))).status,
      200,
    );
    assert.equal(
      (
        await call("/auth/accounts/staff/password", "PUT", {
          password: "ResetStaffPassword123!",
        })
      ).status,
      200,
    );
    assert.equal(
      (await call("/bootstrap", "GET", undefined, takeCookie(changed))).status,
      401,
    );
    assert.equal(
      (
        await call("/auth/accounts/" + adminId + "/password", "PUT", {
          password: "CantResetMyself123!",
        })
      ).status,
      400,
    );
    const logout = await call("/auth/logout", "POST", {});
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get("Set-Cookie")!, /Max-Age=0/);
    assert.equal((await call("/bootstrap")).status, 401);
    const login = await call("/auth/login", "POST", {
      email: setup.email,
      password: setup.password,
    });
    assert.equal(login.status, 200);
    cookie = takeCookie(login);
    sql.prepare("UPDATE auth_sessions SET expires_at=0").run();
    assert.equal((await call("/bootstrap")).status, 401);
    for (let i = 0; i < 10; i++)
      await call("/auth/login", "POST", {
        email: "locked@example.com",
        password: "invalid",
      });
    assert.equal(
      (
        await call("/auth/login", "POST", {
          email: "locked@example.com",
          password: "invalid",
        })
      ).status,
      429,
    );
    assert.equal(
      (await call("/auth/status")).headers.get("Cache-Control"),
      "no-store",
    );
  } finally {
    sql.close();
  }
});
test("password setup is disabled until the owner configures a sufficiently long secret", async () => {
  const { sql, binding } = database();
  try {
    const r = await worker.fetch(new Request(origin + "/api/auth/status"), {
      APP_MODE: "live",
      DB: binding,
    });
    assert.deepEqual(await r.json(), {
      mode: "password",
      setupRequired: true,
      setupEnabled: false,
    });
  } finally {
    sql.close();
  }
});
