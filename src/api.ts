import { makeDemo } from "../shared/demo";
import type { Session, Workspace } from "../shared/types";
const KEY = "cong-trinh-demo-v1";
export class ApiError extends Error {
  constructor(
    message: string,
    public kind: "auth" | "network" | "server",
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export async function request<T>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  let r: Response;
  try {
    r = await fetch("/api" + path, {
      method,
      credentials: "same-origin",
      // Access login redirects must be opened as a page, not followed by fetch.
      redirect: "manual",
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
        ...(data ? { "Content-Type": "application/json" } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
    });
  } catch {
    throw new ApiError(
      "Không gửi được yêu cầu tới Dashboard. Kiểm tra kết nối mạng; tải lại Dashboard để kiểm tra phiên đăng nhập Cloudflare Access rồi thử lại.",
      "network",
    );
  }
  if (
    r.type === "opaqueredirect" ||
    (r.status >= 300 && r.status < 400) ||
    r.status === 401
  )
    throw new ApiError(
      "Phiên đăng nhập chưa hợp lệ hoặc đã hết hạn. Mở lại Dashboard để đăng nhập Cloudflare Access, sau đó thử lại.",
      "auth",
    );
  if (!r.headers.get("content-type")?.includes("application/json")) {
    if (r.status === 403)
      throw new ApiError(
        "Cloudflare từ chối yêu cầu. Mở lại Dashboard để đăng nhập; nếu vẫn lỗi, kiểm tra policy Access và quy tắc bảo vệ Cloudflare.",
        "auth",
      );
    throw new ApiError(
      "Máy chủ API chưa sẵn sàng (HTTP " + r.status + "). Vui lòng thử lại.",
      "server",
    );
  }
  const result = (await r.json()) as T & { error?: string };
  if (!r.ok) throw new ApiError(result.error || "Yêu cầu thất bại.", "server");
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
