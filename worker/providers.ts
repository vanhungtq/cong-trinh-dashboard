import type { Env } from "./index";
import type {
  Project,
  Settings,
  Task,
  TaskStatus,
  Person,
} from "../shared/types";
import { HttpError } from "./auth";
import { localDate } from "../shared/metrics";
export async function trello<T>(
  env: Env,
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  if (!env.TRELLO_API_KEY || !env.TRELLO_TOKEN)
    throw new HttpError(503, "Chưa cấu hình khóa Trello trên máy chủ.");
  const url = new URL("https://api.trello.com/1/" + path);
  url.search = new URLSearchParams({
    ...params,
    key: env.TRELLO_API_KEY,
    token: env.TRELLO_TOKEN,
  }).toString();
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok)
    throw new HttpError(
      502,
      `Trello trả về lỗi ${r.status}. Kiểm tra quyền truy cập và thử lại.`,
    );
  return r.json();
}
export async function getSettings(env: Env): Promise<Settings> {
  const row = await env.DB.prepare("SELECT data FROM settings WHERE id=?")
    .bind("workspace")
    .first<{ data: string }>();
  return row
    ? JSON.parse(row.data)
    : {
        companyName: "Công Trình",
        listMapping: {},
        lastSync: "",
        syncError: "",
      };
}
export async function setSettings(env: Env, data: Settings) {
  await env.DB.prepare(
    "INSERT INTO settings (id,data) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
  )
    .bind("workspace", JSON.stringify(data))
    .run();
}
export function mapTrelloCard(
  c: {
    id: string;
    name: string;
    idList: string;
    idMembers: string[];
    due: string | null;
    url: string;
    closed: boolean;
  },
  projectId: string,
  mapping: Record<string, TaskStatus>,
  people: Person[],
  old?: Task,
): Task {
  const status =
    mapping[c.idList] || (c.closed ? old?.status : undefined) || "todo";
  return {
    id: "trello-" + c.id,
    projectId,
    title: c.name,
    assigneeId:
      people.find((p) => p.trelloId && c.idMembers.includes(p.trelloId))?.id ||
      old?.assigneeId ||
      "",
    status,
    due: c.due ? localDate(new Date(c.due)) : "",
    completedAt: status === "done" ? old?.completedAt || "" : "",
    weight: old?.weight || 0,
    progress: status === "done" ? 100 : Math.min(old?.progress || 0, 99),
    hours: old?.hours || 0,
    reviewRounds: old?.reviewRounds || 0,
    blockReason: old?.blockReason || "",
    url: c.url,
    archived: c.closed,
  };
}
export async function syncTrello(env: Env) {
  const now = Date.now();
  const lock = await env.DB.prepare(
    "INSERT INTO sync_lock (id,expires_at) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET expires_at=excluded.expires_at WHERE sync_lock.expires_at < ?",
  )
    .bind("trello", now + 600000, now)
    .run();
  if (!lock.meta.changes)
    throw new HttpError(409, "Một lượt đồng bộ đang chạy.");
  let settings = await getSettings(env);
  try {
    const rows = await env.DB.prepare("SELECT data FROM projects").all<{
      data: string;
    }>();
    const projects = rows.results
      .map((r) => JSON.parse(r.data) as Project)
      .filter((p) => p.boardId);
    if (!projects.length)
      throw new HttpError(400, "Chưa có dự án nào được gắn bảng Trello.");
    const people = (
      await env.DB.prepare("SELECT data FROM members").all<{ data: string }>()
    ).results.map((r) => JSON.parse(r.data) as Person);
    let count = 0;
    for (const p of projects) {
      const cards = await trello<
        Array<{
          id: string;
          name: string;
          idList: string;
          idMembers: string[];
          due: string | null;
          url: string;
          closed: boolean;
        }>
      >(env, `boards/${p.boardId}/cards`, {
        filter: "all",
        fields: "name,idList,idMembers,due,url,closed",
      });
      if (cards.some((c) => !c.closed && !settings.listMapping[c.idList]))
        throw new HttpError(
          400,
          `Chưa ánh xạ đủ các cột có thẻ trong ${p.code}. Cấu hình trạng thái trước khi đồng bộ.`,
        );
      const oldRows = (
        await env.DB.prepare("SELECT data FROM tasks WHERE project_id=?")
          .bind(p.id)
          .all<{ data: string }>()
      ).results.map((r) => JSON.parse(r.data) as Task);
      const statements = [];
      for (const c of cards) {
        const old = oldRows.find((t) => t.id === "trello-" + c.id);
        const t = mapTrelloCard(c, p.id, settings.listMapping, people, old);
        // A first import has unknown completion date. Only observe completion on a subsequent transition.
        if (old && old.status !== "done" && t.status === "done")
          t.completedAt = localDate();
        statements.push(
          env.DB.prepare(
            "INSERT INTO tasks (id,project_id,data) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET project_id=excluded.project_id,data=excluded.data",
          ).bind(t.id, p.id, JSON.stringify(t)),
        );
        count++;
      }
      // Preserve history when a card disappears from the board. Completed archived
      // cards still contribute to completed work; open archived work leaves the active scope.
      const active = new Set(cards.map((c) => "trello-" + c.id));
      for (const old of oldRows.filter(
        (t) => t.id.startsWith("trello-") && !active.has(t.id),
      ))
        statements.push(
          env.DB.prepare("UPDATE tasks SET data=? WHERE id=?").bind(
            JSON.stringify({ ...old, archived: true }),
            old.id,
          ),
        );
      for (let i = 0; i < statements.length; i += 80)
        await env.DB.batch(statements.slice(i, i + 80));
    }
    settings = await getSettings(env);
    await setSettings(env, {
      ...settings,
      lastSync: new Date().toISOString(),
      syncError: "",
    });
    return { count, projects: projects.length };
  } catch (e) {
    settings = await getSettings(env);
    await setSettings(env, {
      ...settings,
      syncError:
        e instanceof HttpError
          ? e.message
          : "Không thể đồng bộ Trello. Vui lòng thử lại.",
    });
    throw e;
  } finally {
    await env.DB.prepare("DELETE FROM sync_lock WHERE id=?")
      .bind("trello")
      .run();
  }
}
let googleToken: { value: string; until: number } | null = null;
export async function driveFiles(env: Env, folder: string, pageToken?: string) {
  if (!/^[\w-]{10,200}$/.test(folder))
    throw new HttpError(400, "Chưa có mã thư mục Drive hợp lệ.");
  if (
    !env.GOOGLE_CLIENT_ID ||
    !env.GOOGLE_CLIENT_SECRET ||
    !env.GOOGLE_REFRESH_TOKEN
  )
    throw new HttpError(503, "Chưa cấu hình Google Drive trên máy chủ.");
  if (!googleToken || googleToken.until < Date.now()) {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: env.GOOGLE_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new HttpError(502, "Không thể xác thực Google Drive.");
    const data = (await r.json()) as {
      access_token: string;
      expires_in: number;
    };
    googleToken = {
      value: data.access_token,
      until: Date.now() + (data.expires_in - 60) * 1000,
    };
  }
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.search = new URLSearchParams({
    q: `'${folder}' in parents and trashed = false`,
    fields:
      "nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink,size)",
    pageSize: "100",
    orderBy: "modifiedTime desc",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    ...(pageToken ? { pageToken } : {}),
  }).toString();
  const r = await fetch(url, {
    headers: { Authorization: "Bearer " + googleToken.value },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new HttpError(502, `Google Drive trả về lỗi ${r.status}.`);
  return r.json();
}
