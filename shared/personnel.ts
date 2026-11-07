import type { Person, Task } from "./types";
import { isOverdue, projectProgress } from "./metrics";
export interface DailyLog {
  day: string;
  taskId: string;
  memberId: string;
  projectId: string;
  hours: number;
  progress: number;
  done: string;
  plan: string;
  blockers: string;
  updatedAt: string;
}
export interface PersonnelReport {
  day: string;
  source: "current" | "snapshot" | "missing";
  capturedAt: string;
  tasks: Task[];
  logs: DailyLog[];
}
export function personnelMetrics(tasks: Task[], logs: DailyLog[], day: string) {
  const active = tasks.filter((t) => !t.archived || t.status === "done");
  const open = active.filter((t) => t.status !== "done");
  const completed = active.filter(
    (t) => t.status === "done" && t.completedAt === day,
  );
  const timed = completed.filter((t) => t.due && t.completedAt);
  return {
    total: active.length,
    open: open.length,
    done: completed.length,
    overdue: open.filter((t) => isOverdue(t, day)).length,
    blocked: open.filter((t) => t.status === "blocked").length,
    progress: active.some((t) => t.weight > 0) ? projectProgress(active) : null,
    onTime: timed.length
      ? Math.round(
          (timed.filter((t) => t.completedAt <= t.due).length / timed.length) *
            100,
        )
      : null,
    onTimeSample: timed.length,
    hours: Math.round(logs.reduce((s, l) => s + l.hours, 0) * 10) / 10,
    estimated: open.reduce((s, t) => s + t.hours, 0),
  };
}
export function organizationName(person: Person, key: "department" | "team") {
  return person[key]?.trim() || "Chưa phân nhóm";
}
