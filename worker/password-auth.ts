import { z } from "zod";
import type { Env } from "./index";
import type { Person } from "../shared/types";
import { HttpError, roleAllowed } from "./auth";
const cookieName = "__Host-ct_session";
const lifetime = 8 * 60 * 60 * 1000;
const iterations = 100000;
const passwordSchema = z
  .string()
  .min(12, "Mật khẩu cần ít nhất 12 ký tự.")
  .max(128);
const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((v) => v.toLowerCase());
const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
const setupSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(1).max(100),
  password: passwordSchema,
  setupToken: z.string().min(1).max(256),
});
const encoder = new TextEncoder();
const hex = (v: ArrayBuffer | Uint8Array) =>
  Array.from(new Uint8Array(v))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
const random = (n: number) => hex(crypto.getRandomValues(new Uint8Array(n)));
async function digest(v: string) {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(v)));
}
function equal(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
async function derive(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return hex(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: encoder.encode(salt),
        iterations,
      },
      key,
      256,
    ),
  );
}
export async function hashPassword(password: string) {
  passwordSchema.parse(password);
  const salt = random(16);
  return `pbkdf2$${iterations}$${salt}$${await derive(password, salt)}`;
}
async function verify(password: string, stored: string) {
  const [algorithm, count, salt, expected] = stored.split("$");
  if (
    algorithm !== "pbkdf2" ||
    count !== String(iterations) ||
    !salt ||
    !expected
  )
    return false;
  return equal(await derive(password, salt), expected);
}
function sessionHash(req: Request) {
  const value = req.headers
    .get("Cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(cookieName + "="))
    ?.slice(cookieName.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? digest(value) : null;
}
const cookie = (value: string, seconds = lifetime / 1000) =>
  `${cookieName}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${seconds}`;
function reply(data: unknown, session?: string, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...(session ? { "Set-Cookie": session } : {}),
    },
  });
}
async function rateLimit(env: Env, req: Request, scope: string, limit: number) {
  const now = Date.now();
  const id = await digest(scope);
  const row = await env.DB.prepare(
    "INSERT INTO auth_rate_limits (id,attempts,reset_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET attempts=CASE WHEN reset_at <= ? THEN 1 ELSE attempts+1 END, reset_at=CASE WHEN reset_at <= ? THEN excluded.reset_at ELSE reset_at END RETURNING attempts",
  )
    .bind(id, now + 15 * 60000, now, now)
    .first<{ attempts: number }>();
  if (!row || row.attempts > limit)
    throw new HttpError(
      429,
      "Thử đăng nhập quá nhiều lần. Vui lòng chờ 15 phút.",
    );
}
async function newSession(env: Env, memberId: string) {
  const token = random(32);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM auth_sessions WHERE expires_at <= ?").bind(
      Date.now(),
    ),
    env.DB.prepare("INSERT INTO auth_sessions VALUES (?,?,?)").bind(
      await digest(token),
      memberId,
      Date.now() + lifetime,
    ),
  ]);
  return cookie(token);
}
export async function passwordIdentity(
  req: Request,
  env: Env,
): Promise<Person> {
  if (!env.DB) throw new HttpError(503, "Chưa cấu hình D1.");
  const token = sessionHash(req);
  if (!token)
    throw new HttpError(401, "Vui lòng đăng nhập bằng email và mật khẩu.");
  const row = await env.DB.prepare(
    "SELECT m.data FROM auth_sessions s JOIN members m ON m.id=s.member_id JOIN auth_credentials c ON c.member_id=m.id WHERE s.token_hash=? AND s.expires_at > ?",
  )
    .bind(await token, Date.now())
    .first<{ data: string }>();
  if (!row)
    throw new HttpError(
      401,
      "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    );
  return JSON.parse(row.data);
}
export async function handlePasswordAuth(
  req: Request,
  env: Env,
  data: unknown,
): Promise<Response | null> {
  const path = new URL(req.url).pathname;
  if (!path.startsWith("/api/auth/")) return null;
  if (!env.DB) throw new HttpError(503, "Chưa cấu hình D1.");
  if (path === "/api/auth/status" && req.method === "GET") {
    const initialized = await env.DB.prepare(
      "SELECT id FROM auth_bootstrap WHERE id='admin'",
    ).first();
    return reply({
      mode: "password",
      setupRequired: !initialized,
      setupEnabled: !!(
        env.ADMIN_SETUP_TOKEN &&
        env.ADMIN_SETUP_TOKEN.length >= 24 &&
        env.ADMIN_EMAIL
      ),
    });
  }
  if (
    ["/api/auth/setup", "/api/auth/login"].includes(path) &&
    req.method === "POST"
  ) {
    const ip = req.headers.get("CF-Connecting-IP") || "unknown";
    await rateLimit(env, req, "login-ip:" + ip, 30);
    if (path.endsWith("/setup")) {
      const initialized = await env.DB.prepare(
        "SELECT id FROM auth_bootstrap WHERE id='admin'",
      ).first();
      if (initialized)
        throw new HttpError(409, "Tài khoản quản trị đã được khởi tạo.");
      if (
        !env.ADMIN_SETUP_TOKEN ||
        env.ADMIN_SETUP_TOKEN.length < 24 ||
        !env.ADMIN_EMAIL
      )
        throw new HttpError(
          503,
          "Cấu hình ADMIN_EMAIL và secret ADMIN_SETUP_TOKEN có ít nhất 24 ký tự trên Cloudflare trước khi tạo quản trị.",
        );
      const input = setupSchema.parse(data);
      if (
        !equal(
          await digest(input.setupToken),
          await digest(env.ADMIN_SETUP_TOKEN),
        ) ||
        input.email !== env.ADMIN_EMAIL.trim().toLowerCase()
      )
        throw new HttpError(403, "Mã khởi tạo hoặc email quản trị không đúng.");
      const row = await env.DB.prepare("SELECT data FROM members WHERE email=?")
        .bind(input.email)
        .first<{ data: string }>();
      const person: Person = row
        ? JSON.parse(row.data)
        : {
            id: crypto.randomUUID(),
            email: input.email,
            name: input.name,
            role: "admin",
            discipline: "Điều hành",
            capacity: 40,
          };
      person.role = "admin";
      const hash = await hashPassword(input.password);
      try {
        await env.DB.batch([
          env.DB.prepare("INSERT INTO auth_bootstrap VALUES ('admin')"),
          env.DB.prepare(
            "INSERT INTO members (id,email,data) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
          ).bind(person.id, person.email, JSON.stringify(person)),
          env.DB.prepare("INSERT INTO auth_credentials VALUES (?,?,?)").bind(
            person.id,
            hash,
            Date.now(),
          ),
        ]);
      } catch (e) {
        if (
          await env.DB.prepare(
            "SELECT id FROM auth_bootstrap WHERE id='admin'",
          ).first()
        )
          throw new HttpError(409, "Tài khoản quản trị đã được khởi tạo.");
        throw e;
      }
      return reply({ ok: true }, await newSession(env, person.id), 201);
    }
    const input = loginSchema.parse(data);
    await rateLimit(env, req, "login-email:" + input.email, 10);
    const row = await env.DB.prepare(
      "SELECT c.password_hash,c.member_id FROM auth_credentials c JOIN members m ON m.id=c.member_id WHERE m.email=?",
    )
      .bind(input.email)
      .first<{ password_hash: string; member_id: string }>();
    // Run the same derivation for unknown users to reduce account enumeration.
    const hash =
      row?.password_hash ||
      `pbkdf2$${iterations}$00000000000000000000000000000000$${"0".repeat(64)}`;
    const valid = await verify(input.password, hash);
    if (!row || !valid)
      throw new HttpError(401, "Email hoặc mật khẩu không đúng.");
    return reply({ ok: true }, await newSession(env, row.member_id));
  }
  if (path === "/api/auth/logout" && req.method === "POST") {
    const token = sessionHash(req);
    if (token)
      await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash=?")
        .bind(await token)
        .run();
    return reply({ ok: true }, cookie("", 0));
  }
  const user = await passwordIdentity(req, env);
  if (path === "/api/auth/password" && req.method === "PUT") {
    const input = z
      .object({
        currentPassword: z.string().min(1).max(128),
        password: passwordSchema,
      })
      .parse(data);
    const row = await env.DB.prepare(
      "SELECT password_hash FROM auth_credentials WHERE member_id=?",
    )
      .bind(user.id)
      .first<{ password_hash: string }>();
    await rateLimit(env, req, "change-password:" + user.id, 10);
    if (!row || !(await verify(input.currentPassword, row.password_hash)))
      throw new HttpError(400, "Mật khẩu hiện tại không đúng.");
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE auth_credentials SET password_hash=?,updated_at=? WHERE member_id=?",
      ).bind(await hashPassword(input.password), Date.now(), user.id),
      env.DB.prepare("DELETE FROM auth_sessions WHERE member_id=?").bind(
        user.id,
      ),
    ]);
    return reply({ ok: true }, await newSession(env, user.id));
  }
  roleAllowed(user, ["admin"]);
  if (path === "/api/auth/accounts" && req.method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT m.id, CASE WHEN c.member_id IS NULL THEN 0 ELSE 1 END AS enabled FROM members m LEFT JOIN auth_credentials c ON c.member_id=m.id",
    ).all();
    return reply(rows.results);
  }
  const match = path.match(/^\/api\/auth\/accounts\/([^/]+)\/password$/);
  if (match && req.method === "PUT") {
    if (match[1] === user.id)
      throw new HttpError(
        400,
        "Dùng mục Đổi mật khẩu để đổi mật khẩu của bạn.",
      );
    const input = z.object({ password: passwordSchema }).parse(data);
    const member = await env.DB.prepare("SELECT id FROM members WHERE id=?")
      .bind(match[1])
      .first();
    if (!member) throw new HttpError(404, "Không tìm thấy nhân sự.");
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO auth_credentials VALUES (?,?,?) ON CONFLICT(member_id) DO UPDATE SET password_hash=excluded.password_hash,updated_at=excluded.updated_at",
      ).bind(match[1], await hashPassword(input.password), Date.now()),
      env.DB.prepare("DELETE FROM auth_sessions WHERE member_id=?").bind(
        match[1],
      ),
      env.DB.prepare("INSERT INTO audit_log VALUES (?,?,?,?,?,?)").bind(
        crypto.randomUUID(),
        user.email,
        "account.password.reset",
        match[1],
        new Date().toISOString(),
        "{}",
      ),
    ]);
    return reply({ ok: true });
  }
  throw new HttpError(404, "Không tìm thấy chức năng tài khoản.");
}
