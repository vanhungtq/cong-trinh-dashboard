import type { Person, Task, Workspace } from "./types";
import { isOverdue, projectProgress } from "./metrics";
export type OfficeState =
  "overdue" | "blocked" | "review" | "working" | "done" | "idle" | "planned";
export const officeStates: Record<
  OfficeState,
  { label: string; color: string }
> = {
  overdue: { label: "Có việc quá hạn", color: "#d75d61" },
  blocked: { label: "Đang vướng mắc", color: "#dca342" },
  review: { label: "Chờ kiểm tra", color: "#9271cb" },
  working: { label: "Đang thực hiện", color: "#4d91c5" },
  done: { label: "Đã hoàn thành việc được giao", color: "#45a181" },
  planned: { label: "Chờ bắt đầu", color: "#8a9cb4" },
  idle: { label: "Chưa có việc đang mở", color: "#9aa69d" },
};
export function officePerson(person: Person, tasks: Task[]) {
  const own = tasks.filter(
    (t) => t.assigneeId === person.id && (!t.archived || t.status === "done"),
  );
  const open = own.filter((t) => t.status !== "done");
  const late = open.filter((t) => isOverdue(t));
  const blocked = open.filter((t) => t.status === "blocked");
  const state: OfficeState = late.length
    ? "overdue"
    : blocked.length
      ? "blocked"
      : open.some((t) => t.status === "review")
        ? "review"
        : open.some((t) => t.status === "doing")
          ? "working"
          : open.length
            ? "planned"
            : own.length
              ? "done"
              : "idle";
  return {
    person,
    tasks: own,
    open: open.length,
    overdue: late.length,
    blocked: blocked.length,
    state,
    progress: own.some((t) => t.weight > 0) ? projectProgress(own) : null,
  };
}
export type OfficePerson = ReturnType<typeof officePerson>;
export interface OfficeRoom {
  id: string;
  name: string;
  part: number;
  people: OfficePerson[];
  color: string;
}
const palette = [
  "#77a999",
  "#87aace",
  "#b09acb",
  "#d3ad83",
  "#8fb7b0",
  "#c796a1",
];
export function officePeople(w: Workspace, user: Person) {
  if (user.role === "admin") return w.people;
  if (user.role === "manager") {
    const allowed = new Set(
      w.projects.filter((p) => p.managerId === user.id).map((p) => p.id),
    );
    return w.people.filter(
      (p) =>
        p.id === user.id ||
        w.tasks.some((t) => allowed.has(t.projectId) && t.assigneeId === p.id),
    );
  }
  return w.people.filter((p) => p.id === user.id);
}
export function officeRooms(people: OfficePerson[]): OfficeRoom[] {
  const groups = new Map<string, OfficePerson[]>();
  for (const p of people) {
    const name = p.person.department?.trim() || "Chưa phân phòng";
    groups.set(name, [...(groups.get(name) || []), p]);
  }
  const rooms: OfficeRoom[] = [];
  [...groups]
    .sort(([a], [b]) => a.localeCompare(b, "vi"))
    .forEach(([name, members], i) => {
      for (let j = 0; j < members.length; j += 8)
        rooms.push({
          id: name + ":" + j,
          name,
          part: Math.floor(j / 8) + 1,
          people: members.slice(j, j + 8),
          color: palette[i % palette.length],
        });
    });
  return rooms;
}
