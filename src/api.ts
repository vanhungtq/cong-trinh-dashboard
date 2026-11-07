import { makeDemo } from "../shared/demo";
import type { Session, Workspace } from "../shared/types";
const KEY = "cong-trinh-demo-v1";
export async function request<T>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const r = await fetch("/api" + path, {
    method,
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!r.headers.get("content-type")?.includes("application/json"))
    throw Error("Máy chủ API chưa sẵn sàng.");
  const result = (await r.json()) as T & { error?: string };
  if (!r.ok) throw Error(result.error || "Yêu cầu thất bại.");
  return result;
}
export async function bootstrap(): Promise<{
  workspace: Workspace;
  session: Session;
}> {
  let data: { workspace: Workspace; session: Session };
  if (import.meta.env.DEV) {
    const workspace = makeDemo();
    data = {
      workspace,
      session: {
        mode: "demo",
        user: workspace.people[0],
        integrations: { trello: false, drive: false },
      },
    };
  } else data = await request("/bootstrap");
  if (data.session.mode === "demo") {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          Array.isArray(parsed.projects) &&
          Array.isArray(parsed.tasks) &&
          Array.isArray(parsed.people) &&
          Array.isArray(parsed.receipts) &&
          Array.isArray(parsed.documents) &&
          Array.isArray(parsed.terms) &&
          parsed.settings
        )
          data.workspace = parsed;
      }
    } catch {
      localStorage.removeItem(KEY);
    }
  }
  return data;
}
export function persistDemo(w: Workspace) {
  localStorage.setItem(KEY, JSON.stringify(w));
}
export function resetDemo() {
  localStorage.removeItem(KEY);
  return makeDemo();
}
