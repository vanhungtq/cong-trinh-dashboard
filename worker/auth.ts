import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Person } from "../shared/types";
import type { Env } from "./index";
const jwks = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function roleAllowed(user: Person, roles: Person["role"][]) {
  if (!roles.includes(user.role))
    throw new HttpError(403, "Bạn không có quyền thực hiện thao tác này.");
}
export async function identity(request: Request, env: Env): Promise<Person> {
  if (
    !env.DB ||
    !env.CF_ACCESS_TEAM_DOMAIN ||
    !env.CF_ACCESS_AUD ||
    !env.ADMIN_EMAIL
  )
    throw new HttpError(
      503,
      "Chưa cấu hình D1, Cloudflare Access hoặc email quản trị.",
    );
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.CF_ACCESS_TEAM_DOMAIN))
    throw new HttpError(503, "Tên miền Cloudflare Access không hợp lệ.");
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token)
    throw new HttpError(401, "Vui lòng đăng nhập qua Cloudflare Access.");
  const issuer = "https://" + env.CF_ACCESS_TEAM_DOMAIN;
  if (!jwks.has(issuer))
    jwks.set(
      issuer,
      createRemoteJWKSet(new URL(issuer + "/cdn-cgi/access/certs")),
    );
  let email: string;
  try {
    const { payload } = await jwtVerify(token, jwks.get(issuer)!, {
      issuer,
      audience: env.CF_ACCESS_AUD,
      algorithms: ["RS256"],
    });
    if (typeof payload.email !== "string") throw Error();
    email = payload.email.toLowerCase();
  } catch {
    throw new HttpError(401, "Phiên đăng nhập hết hạn hoặc không hợp lệ.");
  }
  const row = await env.DB.prepare("SELECT data FROM members WHERE email = ?")
    .bind(email)
    .first<{ data: string }>();
  if (row) return JSON.parse(row.data);
  if (email === env.ADMIN_EMAIL.toLowerCase()) {
    const user: Person = {
      id: crypto.randomUUID(),
      name: email.split("@")[0],
      email,
      role: "admin",
      discipline: "Điều hành",
      capacity: 40,
    };
    await env.DB.prepare(
      "INSERT OR IGNORE INTO members (id,email,data) VALUES (?,?,?)",
    )
      .bind(user.id, email, JSON.stringify(user))
      .run();
    const actual = await env.DB.prepare(
      "SELECT data FROM members WHERE email=?",
    )
      .bind(email)
      .first<{ data: string }>();
    return JSON.parse(actual!.data);
  }
  throw new HttpError(403, "Email chưa được thêm vào đội ngũ của công ty.");
}
