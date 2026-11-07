import type { Person, Task } from "./types";
import { isOverdue, projectProgress } from "./metrics";
export interface PersonnelReport {
  day: string;
  source: "current" | "snapshot" | "missing";
  capturedAt: string;
  tasks: Task[];
  previousDay: string;
  previousAvailable: boolean;
  previousTasks: Task[];
}
export function personnelMetrics(tasks: Task[], day: string) {
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
    estimated: open.reduce((s, t) => s + t.hours, 0),
  };
}
export function organizationName(person: Person, key: "department" | "team") {
  return person[key]?.trim() || "Chưa phân nhóm";
}

export function taskMovement(
  tasks: Task[],
  previous: Task[],
  available: boolean,
) {
  if (!available) return { improved: null, completed: null, changed: null };
  const before = new Map(previous.map((t) => [t.id, t]));
  const comparable = tasks.filter(
    (t) => !t.archived && before.get(t.id)?.assigneeId === t.assigneeId,
  );
  return {
    improved: comparable.filter(
      (t) => t.progress > (before.get(t.id)?.progress || 0),
    ).length,
    completed: comparable.filter(
      (t) => t.status === "done" && before.get(t.id)?.status !== "done",
    ).length,
    changed: comparable.filter((t) => t.status !== before.get(t.id)?.status)
      .length,
  };
}
