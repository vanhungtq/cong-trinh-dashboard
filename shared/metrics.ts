import type { Project, Task, Receipt, PaymentTerm } from "./types";
export function localDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function projectProgress(tasks: Task[]) {
  tasks = tasks.filter((t) => !t.archived || t.status === "done");
  const total = tasks.reduce((s, t) => s + t.weight, 0);
  return total
    ? Math.round(
        tasks.reduce(
          (s, t) => s + t.weight * Math.max(0, Math.min(100, t.progress)),
          0,
        ) / total,
      )
    : 0;
}
export function plannedProgress(p: Project, today = localDate()) {
  const start = Date.parse(p.start),
    end = Date.parse(p.due);
  if (end <= start) return today >= p.due ? 100 : 0;
  return Math.round(
    Math.max(
      0,
      Math.min(100, ((Date.parse(today) - start) / (end - start)) * 100),
    ),
  );
}
export function isOverdue(t: Task, today = localDate()) {
  return !t.archived && !!t.due && t.due < today && t.status !== "done";
}
export function projectHealth(
  p: Project,
  tasks: Task[],
  today = localDate(),
): "completed" | "paused" | "late" | "risk" | "ontrack" {
  if (p.status === "completed") return "completed";
  if (p.status === "paused") return "paused";
  if (
    (p.due < today && projectProgress(tasks) < 100) ||
    tasks.some((t) => isOverdue(t, today))
  )
    return "late";
  if (tasks.some((t) => !t.archived && t.status === "blocked")) return "risk";
  return "ontrack";
}
export const healthLabels = {
  completed: "Hoàn thành",
  paused: "Tạm dừng",
  late: "Chậm tiến độ",
  risk: "Cần chú ý",
  ontrack: "Đúng tiến độ",
};
export function totals(
  projects: Project[],
  receipts: Receipt[],
  terms: PaymentTerm[],
  today = localDate(),
) {
  return {
    contract: projects.reduce((s, p) => s + p.contract, 0),
    accepted: projects.reduce((s, p) => s + p.accepted, 0),
    received: receipts.reduce((s, r) => s + r.amount, 0),
    overdue: terms
      .filter((t) => t.due < today)
      .reduce((s, t) => s + Math.max(0, t.amount - t.received), 0),
  };
}
export function onTimeRate(tasks: Task[]) {
  const eligible = tasks.filter(
    (t) => t.status === "done" && t.completedAt && t.due,
  );
  return eligible.length
    ? Math.round(
        (eligible.filter((t) => t.completedAt.slice(0, 10) <= t.due).length /
          eligible.length) *
          100,
      )
    : null;
}
export function money(v: number, compact = false) {
  if (compact) {
    if (Math.abs(v) >= 1e9)
      return (
        (v / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 2 }) + " tỷ"
      );
    if (Math.abs(v) >= 1e6)
      return (
        (v / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + " tr"
      );
  }
  return v.toLocaleString("vi-VN") + " ₫";
}
export function dateLabel(v: string) {
  return v
    ? new Date(v.slice(0, 10) + "T12:00:00+07:00").toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "Chưa đặt";
}
export function csv(rows: (string | number)[][]) {
  return (
    "\uFEFF" +
    rows
      .map((r) =>
        r
          .map(
            (v) =>
              '"' +
              String(v)
                .replace(/^[=+@\-\t\r]/, "'$&")
                .replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\r\n")
  );
}
