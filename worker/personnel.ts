import { z } from "zod";
import type { Env } from "./index";
import type { Person, Task, Project } from "../shared/types";
import type { PersonnelReport } from "../shared/personnel";
import { localDate } from "../shared/metrics";
import { HttpError, roleAllowed } from "./auth";
const daySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Ngày không hợp lệ",
  );
export async function capturePersonnel(env: Env) {
  const day = localDate(),
    capturedAt = new Date().toISOString();
  const tasks = (
    await env.DB.prepare("SELECT data FROM tasks").all<{ data: string }>()
  ).results.map((r) => JSON.parse(r.data) as Task);
  // Keep each published day's snapshot complete; a day with no tasks is recorded too.
  const statements = [
    env.DB.prepare("DELETE FROM personnel_snapshots WHERE day=?").bind(day),
    ...tasks.map((t) =>
      env.DB.prepare(
        "INSERT INTO personnel_snapshots VALUES (?,?,?,?,?,?)",
      ).bind(
        day,
        t.id,
        t.projectId,
        t.assigneeId,
        capturedAt,
        JSON.stringify(t),
      ),
    ),
    env.DB.prepare(
      "INSERT INTO personnel_days VALUES (?,?) ON CONFLICT(day) DO UPDATE SET captured_at=excluded.captured_at",
    ).bind(day, capturedAt),
  ];
  // D1 batches are transactional; one batch prevents incomplete daily snapshots.
  await env.DB.batch(statements);
}
async function scope<T extends Pick<Task, "projectId" | "assigneeId">>(
  env: Env,
  user: Person,
  tasks: T[],
) {
  if (user.role === "admin") return tasks;
  if (user.role !== "manager")
    return tasks.filter((t) => t.assigneeId === user.id);
  const projects = (
    await env.DB.prepare("SELECT data FROM projects").all<{ data: string }>()
  ).results.map((r) => JSON.parse(r.data) as Project);
  const ids = new Set(
    projects.filter((p) => p.managerId === user.id).map((p) => p.id),
  );
  return tasks.filter((t) => ids.has(t.projectId));
}
export async function personnelReport(
  env: Env,
  user: Person,
  day: string,
): Promise<PersonnelReport> {
  daySchema.parse(day);
  if (day > localDate())
    throw new HttpError(400, "Không có báo cáo cho ngày tương lai.");
  const current = day === localDate();
  const marker = current
    ? null
    : await env.DB.prepare("SELECT captured_at FROM personnel_days WHERE day=?")
        .bind(day)
        .first<{ captured_at: string }>();
  const rows = current
    ? await env.DB.prepare("SELECT data FROM tasks").all<{ data: string }>()
    : await env.DB.prepare("SELECT data FROM personnel_snapshots WHERE day=?")
        .bind(day)
        .all<{ data: string }>();
  const tasks = await scope(
    env,
    user,
    rows.results.map((r) => JSON.parse(r.data) as Task),
  );
  const previousDay = new Date(Date.parse(day + "T00:00:00Z") - 86400000)
    .toISOString()
    .slice(0, 10);
  const previousMarker = await env.DB.prepare(
    "SELECT day FROM personnel_days WHERE day=?",
  )
    .bind(previousDay)
    .first();
  const previousRows = await env.DB.prepare(
    "SELECT data FROM personnel_snapshots WHERE day=?",
  )
    .bind(previousDay)
    .all<{ data: string }>();
  const previousTasks = await scope(
    env,
    user,
    previousRows.results.map((r) => JSON.parse(r.data) as Task),
  );
  return {
    day,
    source: current ? "current" : marker ? "snapshot" : "missing",
    capturedAt: current ? new Date().toISOString() : marker?.captured_at || "",
    tasks,
    previousDay,
    previousAvailable: !!previousMarker && (current || !!marker),
    previousTasks,
  };
}
export async function updateMember(
  env: Env,
  user: Person,
  id: string,
  input: Person,
) {
  roleAllowed(user, ["admin"]);
  const row = await env.DB.prepare("SELECT data FROM members WHERE id=?")
    .bind(id)
    .first<{ data: string }>();
  if (!row) throw new HttpError(404, "Không tìm thấy nhân sự.");
  if (id === user.id && input.role !== "admin")
    throw new HttpError(400, "Không thể tự hạ quyền quản trị của bạn.");
  const duplicate = await env.DB.prepare(
    "SELECT id FROM members WHERE email=? AND id<>?",
  )
    .bind(input.email, id)
    .first();
  if (duplicate) throw new HttpError(409, "Email đã thuộc một nhân sự khác.");
  const member = { ...input, id };
  await env.DB.batch([
    env.DB.prepare("UPDATE members SET email=?,data=? WHERE id=?").bind(
      member.email,
      JSON.stringify(member),
      id,
    ),
    env.DB.prepare("INSERT INTO audit_log VALUES (?,?,?,?,?,?)").bind(
      crypto.randomUUID(),
      user.email,
      "member.update",
      id,
      new Date().toISOString(),
      JSON.stringify({ before: JSON.parse(row.data), after: member }),
    ),
  ]);
  return member;
}
