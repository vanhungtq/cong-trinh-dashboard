import { ZodError } from "zod";
import { makeDemo } from "../shared/demo";
import type {
  Workspace,
  Person,
  Project,
  Task,
  PaymentTerm,
} from "../shared/types";
import { HttpError, identity, roleAllowed } from "./auth";
import {
  documentSchema,
  memberSchema,
  projectSchema,
  receiptSchema,
  settingsSchema,
  taskSchema,
  termSchema,
} from "./validation";
import {
  driveFiles,
  getSettings,
  setSettings,
  syncTrello,
  trello,
} from "./providers";
export interface Env {
  DB: D1Database;
  APP_MODE?: string;
  ADMIN_EMAIL?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  TRELLO_API_KEY?: string;
  TRELLO_TOKEN?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REFRESH_TOKEN?: string;
}
declare const __ASSETS__: Record<string, { body: string; type: string }>;
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
async function body(req: Request) {
  if (!req.headers.get("content-type")?.includes("application/json"))
    throw new HttpError(415, "Yêu cầu phải là JSON.");
  const s = await req.text();
  if (s.length > 100000) throw new HttpError(413, "Dữ liệu quá lớn.");
  try {
    return JSON.parse(s);
  } catch {
    throw new HttpError(400, "JSON không hợp lệ.");
  }
}
async function readRows<T>(env: Env, table: string): Promise<T[]> {
  const result = await env.DB.prepare(`SELECT data FROM ${table}`).all<{
    data: string;
  }>();
  return result.results.map((r) => JSON.parse(r.data));
}
async function audit(
  env: Env,
  user: Person,
  action: string,
  id: string,
  data: unknown,
) {
  return env.DB.prepare(
    "INSERT INTO audit_log (id,actor,action,entity_id,created_at,data) VALUES (?,?,?,?,?,?)",
  ).bind(
    crypto.randomUUID(),
    user.email,
    action,
    id,
    new Date().toISOString(),
    JSON.stringify(data),
  );
}
async function projectAccess(env: Env, user: Person, id: string) {
  const row = await env.DB.prepare("SELECT data FROM projects WHERE id=?")
    .bind(id)
    .first<{ data: string }>();
  if (!row) throw new HttpError(404, "Không tìm thấy dự án.");
  const p = JSON.parse(row.data) as Project;
  if (user.role === "staff") {
    const tasks = await env.DB.prepare(
      "SELECT data FROM tasks WHERE project_id=?",
    )
      .bind(id)
      .all<{ data: string }>();
    if (
      !tasks.results.some(
        (r) => (JSON.parse(r.data) as Task).assigneeId === user.id,
      )
    )
      throw new HttpError(403, "Bạn chưa được phân công vào dự án này.");
  }
  if (user.role === "manager" && p.managerId !== user.id)
    throw new HttpError(403, "Bạn không phụ trách dự án này.");
  return p;
}
export async function handleApi(req: Request, env: Env) {
  const url = new URL(req.url),
    path = url.pathname;
  const demo = env.APP_MODE !== "live";
  if (demo) {
    if (path === "/api/bootstrap" && req.method === "GET") {
      const workspace = makeDemo();
      return json({
        workspace,
        session: {
          mode: "demo",
          user: workspace.people[0],
          integrations: { trello: false, drive: false },
        },
      });
    }
    throw new HttpError(
      409,
      "Bản dùng thử chỉ thay đổi dữ liệu mẫu trong trình duyệt.",
    );
  }
  const user = await identity(req, env);
  if (
    !["GET", "HEAD"].includes(req.method) &&
    req.headers.get("Origin") !== url.origin
  )
    throw new HttpError(403, "Nguồn yêu cầu không hợp lệ.");
  if (path === "/api/bootstrap" && req.method === "GET") {
    const [projects, tasks, people, receipts, terms, documents, settings] =
      await Promise.all([
        readRows<Workspace["projects"][number]>(env, "projects"),
        readRows<Workspace["tasks"][number]>(env, "tasks"),
        readRows<Person>(env, "members"),
        readRows<Workspace["receipts"][number]>(env, "receipts"),
        readRows<Workspace["terms"][number]>(env, "payment_terms"),
        readRows<Workspace["documents"][number]>(env, "documents"),
        getSettings(env),
      ]);
    let visible = projects;
    if (user.role === "manager")
      visible = projects.filter((p) => p.managerId === user.id);
    if (user.role === "staff")
      visible = projects.filter((p) =>
        tasks.some((t) => t.projectId === p.id && t.assigneeId === user.id),
      );
    const ids = new Set(visible.map((p) => p.id));
    const financial = user.role !== "staff";
    return json({
      workspace: {
        projects: visible.map((p) =>
          financial ? p : { ...p, contract: 0, accepted: 0 },
        ),
        tasks: tasks.filter((t) => ids.has(t.projectId)),
        people: people.map((p) =>
          user.role === "admin" ? p : { ...p, email: "", trelloId: undefined },
        ),
        receipts: financial ? receipts.filter((r) => ids.has(r.projectId)) : [],
        terms: financial ? terms.filter((t) => ids.has(t.projectId)) : [],
        documents: documents.filter(
          (d) =>
            ids.has(d.projectId) &&
            (user.role !== "staff" ||
              !["Hợp đồng", "Thanh toán", "Nghiệm thu"].includes(d.category)),
        ),
        settings:
          user.role === "admin" ? settings : { ...settings, listMapping: {} },
      },
      session: {
        mode: "live",
        user,
        integrations: {
          trello: !!(env.TRELLO_API_KEY && env.TRELLO_TOKEN),
          drive: !!(
            env.GOOGLE_CLIENT_ID &&
            env.GOOGLE_CLIENT_SECRET &&
            env.GOOGLE_REFRESH_TOKEN
          ),
        },
      },
    });
  }
  if (path === "/api/projects" && req.method === "POST") {
    roleAllowed(user, ["admin"]);
    const data = projectSchema.parse(await body(req));
    const id = crypto.randomUUID();
    const all = await readRows<Project>(env, "projects");
    if (
      all.some(
        (p) =>
          p.code.toLowerCase() === data.code.toLowerCase() ||
          (data.boardId && p.boardId === data.boardId),
      )
    )
      throw new HttpError(409, "Mã dự án hoặc bảng Trello đã được sử dụng.");
    const manager = await env.DB.prepare("SELECT id FROM members WHERE id=?")
      .bind(data.managerId)
      .first();
    if (!manager) throw new HttpError(400, "Người phụ trách không tồn tại.");
    const p = {
      ...data,
      id,
      boardUrl: data.boardId ? "https://trello.com/b/" + data.boardId : "",
    };
    await env.DB.batch([
      env.DB.prepare("INSERT INTO projects (id,data) VALUES (?,?)").bind(
        id,
        JSON.stringify(p),
      ),
      await audit(env, user, "project.create", id, p),
    ]);
    return json(p, 201);
  }
  const projectMatch = path.match(/^\/api\/projects\/([^/]+)$/);
  if (projectMatch && req.method === "PUT") {
    roleAllowed(user, ["admin"]);
    const old = await projectAccess(env, user, projectMatch[1]);
    const p = { ...projectSchema.parse(await body(req)), id: old.id };
    const all = await readRows<Project>(env, "projects");
    if (
      all.some(
        (x) =>
          x.id !== p.id &&
          (x.code.toLowerCase() === p.code.toLowerCase() ||
            (p.boardId && x.boardId === p.boardId)),
      )
    )
      throw new HttpError(409, "Mã dự án hoặc bảng Trello đã được sử dụng.");
    await env.DB.batch([
      env.DB.prepare("UPDATE projects SET data=? WHERE id=?").bind(
        JSON.stringify(p),
        p.id,
      ),
      await audit(env, user, "project.update", p.id, { before: old, after: p }),
    ]);
    return json(p);
  }
  if (path === "/api/receipts" && req.method === "POST") {
    roleAllowed(user, ["admin", "finance"]);
    const d = receiptSchema.parse(await body(req));
    await projectAccess(env, user, d.projectId);
    const duplicate = await env.DB.prepare(
      "SELECT id FROM receipts WHERE project_id=? AND json_extract(data,'$.reference')=? COLLATE NOCASE",
    )
      .bind(d.projectId, d.reference)
      .first();
    if (duplicate)
      throw new HttpError(409, "Mã chứng từ đã được ghi nhận trong dự án này.");
    const id = crypto.randomUUID();
    const { termId, ...rest } = d;
    const r = { ...rest, id };
    const statements = [
      env.DB.prepare(
        "INSERT INTO receipts (id,project_id,data) VALUES (?,?,?)",
      ).bind(id, d.projectId, JSON.stringify(r)),
    ];
    if (termId) {
      const row = await env.DB.prepare(
        "SELECT data FROM payment_terms WHERE id=? AND project_id=?",
      )
        .bind(termId, d.projectId)
        .first<{ data: string }>();
      if (!row) throw new HttpError(400, "Đợt thanh toán không thuộc dự án.");
      const term = JSON.parse(row.data) as PaymentTerm;
      if (term.received + d.amount > term.amount)
        throw new HttpError(
          400,
          "Số tiền vượt phần còn lại của đợt thanh toán.",
        );
      // Increment in SQL to avoid lost updates; a trigger enforces the amount cap atomically.
      statements.push(
        env.DB.prepare(
          "UPDATE payment_terms SET data=json_set(data,'$.received',json_extract(data,'$.received')+?) WHERE id=?",
        ).bind(d.amount, termId),
      );
    }
    statements.push(await audit(env, user, "receipt.create", id, r));
    await env.DB.batch(statements);
    return json(r, 201);
  }
  if (path === "/api/terms" && req.method === "POST") {
    roleAllowed(user, ["admin", "finance"]);
    const d = termSchema.parse(await body(req));
    await projectAccess(env, user, d.projectId);
    const t = { ...d, id: crypto.randomUUID(), received: 0 };
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO payment_terms (id,project_id,data) VALUES (?,?,?)",
      ).bind(t.id, t.projectId, JSON.stringify(t)),
      await audit(env, user, "term.create", t.id, t),
    ]);
    return json(t, 201);
  }
  if (path === "/api/documents" && req.method === "POST") {
    roleAllowed(user, ["admin", "manager", "staff"]);
    const d = documentSchema.parse(await body(req));
    await projectAccess(env, user, d.projectId);
    if (
      user.role === "staff" &&
      ["Hợp đồng", "Thanh toán", "Nghiệm thu"].includes(d.category)
    )
      throw new HttpError(403, "Không có quyền với hồ sơ tài chính.");
    const doc = {
      ...d,
      id: crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
    };
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO documents (id,project_id,data) VALUES (?,?,?)",
      ).bind(doc.id, doc.projectId, JSON.stringify(doc)),
      await audit(env, user, "document.create", doc.id, doc),
    ]);
    return json(doc, 201);
  }
  if (path === "/api/members" && req.method === "POST") {
    roleAllowed(user, ["admin"]);
    const d = memberSchema.parse(await body(req));
    const exists = await env.DB.prepare("SELECT id FROM members WHERE email=?")
      .bind(d.email)
      .first();
    if (exists) throw new HttpError(409, "Email này đã có trong đội ngũ.");
    const member = { ...d, id: crypto.randomUUID() };
    await env.DB.batch([
      env.DB.prepare("INSERT INTO members (id,email,data) VALUES (?,?,?)").bind(
        member.id,
        member.email,
        JSON.stringify(member),
      ),
      await audit(env, user, "member.create", member.id, member),
    ]);
    return json(member, 201);
  }
  const taskMatch = path.match(/^\/api\/tasks\/([^/]+)$/);
  if (taskMatch && req.method === "PATCH") {
    roleAllowed(user, ["admin", "manager"]);
    const d = taskSchema.parse(await body(req));
    const row = await env.DB.prepare("SELECT data FROM tasks WHERE id=?")
      .bind(taskMatch[1])
      .first<{ data: string }>();
    if (!row) throw new HttpError(404, "Không tìm thấy công việc.");
    const old = JSON.parse(row.data) as Task;
    await projectAccess(env, user, old.projectId);
    const t = { ...old, ...d };
    await env.DB.batch([
      env.DB.prepare("UPDATE tasks SET data=? WHERE id=?").bind(
        JSON.stringify(t),
        t.id,
      ),
      await audit(env, user, "task.update", t.id, { before: old, after: t }),
    ]);
    return json(t);
  }
  if (path === "/api/settings" && req.method === "PUT") {
    roleAllowed(user, ["admin"]);
    const data = settingsSchema.parse(await body(req));
    await setSettings(env, { ...(await getSettings(env)), ...data });
    return json({ ok: true });
  }
  if (path === "/api/trello/boards" && req.method === "GET") {
    roleAllowed(user, ["admin"]);
    return json(
      await trello(env, "members/me/boards", {
        filter: "open",
        fields: "name,url",
        lists: "open",
        list_fields: "name",
      }),
    );
  }
  if (path === "/api/trello/sync" && req.method === "POST") {
    roleAllowed(user, ["admin"]);
    return json(await syncTrello(env));
  }
  if (path === "/api/drive/files" && req.method === "GET") {
    roleAllowed(user, ["admin", "manager"]);
    const p = await projectAccess(
      env,
      user,
      url.searchParams.get("projectId") || "",
    );
    return json(
      await driveFiles(
        env,
        p.driveFolderId,
        url.searchParams.get("pageToken") || undefined,
      ),
    );
  }
  throw new HttpError(404, "Không tìm thấy chức năng.");
}
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      const path = new URL(req.url).pathname;
      if (path.startsWith("/api/")) return await handleApi(req, env);
      if (req.method !== "GET" && req.method !== "HEAD")
        return new Response("Method not allowed", { status: 405 });
      const asset =
        __ASSETS__[path === "/" ? "/index.html" : path] ||
        (!path.split("/").pop()?.includes(".")
          ? __ASSETS__["/index.html"]
          : undefined);
      if (!asset) return new Response("Not found", { status: 404 });
      const bytes = Uint8Array.from(atob(asset.body), (c) => c.charCodeAt(0));
      return new Response(req.method === "HEAD" ? null : bytes, {
        headers: {
          "Content-Type": asset.type,
          "Cache-Control": path.startsWith("/assets/")
            ? "public,max-age=31536000,immutable"
            : "no-cache",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "strict-origin-when-cross-origin",
          "Content-Security-Policy":
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
        },
      });
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      if (e instanceof ZodError)
        return json(
          {
            error: e.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; "),
          },
          400,
        );
      console.error("Request failed:", e instanceof Error ? e.name : "Unknown");
      return json(
        {
          error:
            "Không thể xử lý yêu cầu. Vui lòng thử lại hoặc kiểm tra nhật ký máy chủ.",
        },
        500,
      );
    }
  },
  async scheduled(
    _event: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ) {
    if (
      env.APP_MODE === "live" &&
      env.DB &&
      env.TRELLO_API_KEY &&
      env.TRELLO_TOKEN
    )
      ctx.waitUntil(syncTrello(env).catch(() => {}));
  },
};
