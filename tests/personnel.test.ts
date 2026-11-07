import test from "node:test";
import assert from "node:assert/strict";
import { database } from "./database";
import { makeDemo } from "../shared/demo";
import {
  capturePersonnel,
  personnelReport,
  updateMember,
} from "../worker/personnel";
import { personnelMetrics, taskMovement } from "../shared/personnel";
import { localDate } from "../shared/metrics";
import type { Env } from "../worker/index";
test("automatic personnel reports use scoped daily task history, not submitted logs", async () => {
  const { sql, binding } = database(),
    w = makeDemo(),
    env = { DB: binding } as Env,
    today = localDate();
  for (const p of w.people)
    sql
      .prepare("INSERT INTO members VALUES (?,?,?)")
      .run(p.id, p.email, JSON.stringify(p));
  for (const p of w.projects)
    sql
      .prepare("INSERT INTO projects VALUES (?,?)")
      .run(p.id, JSON.stringify(p));
  for (const t of w.tasks)
    sql
      .prepare("INSERT INTO tasks VALUES (?,?,?)")
      .run(t.id, t.projectId, JSON.stringify(t));
  try {
    const admin = w.people.find((p) => p.role === "admin")!,
      staff = w.people.find((p) => p.role === "staff")!,
      manager = w.people.find((p) => p.role === "manager")!;
    const all = await personnelReport(env, admin, today);
    assert.equal(all.tasks.length, w.tasks.length);
    assert.equal(all.previousAvailable, false);
    assert.ok(!("logs" in all));
    const self = await personnelReport(env, staff, today);
    assert.ok(self.tasks.every((t) => t.assigneeId === staff.id));
    const ids = w.projects
      .filter((p) => p.managerId === manager.id)
      .map((p) => p.id);
    assert.ok(
      (await personnelReport(env, manager, today)).tasks.every((t) =>
        ids.includes(t.projectId),
      ),
    );
    await capturePersonnel(env);
    const yesterday = new Date(Date.parse(today + "T00:00:00Z") - 86400000)
      .toISOString()
      .slice(0, 10);
    sql.prepare("UPDATE personnel_snapshots SET day=?").run(yesterday);
    sql.prepare("UPDATE personnel_days SET day=?").run(yesterday);
    const task = w.tasks.find((t) => t.status === "doing" && t.progress < 90)!;
    sql
      .prepare(
        "UPDATE tasks SET data=json_set(data,'$.progress',99) WHERE id=?",
      )
      .run(task.id);
    const report = await personnelReport(env, admin, today);
    assert.equal(report.previousAvailable, true);
    assert.equal(report.previousDay, yesterday);
    assert.equal(
      report.previousTasks.find((t) => t.id === task.id)!.progress,
      task.progress,
    );
    assert.equal(
      taskMovement(report.tasks, report.previousTasks, true).improved,
      1,
    );
    const historic = await personnelReport(env, admin, yesterday);
    assert.equal(historic.source, "snapshot");
    assert.equal(
      historic.tasks.find((t) => t.id === task.id)!.progress,
      task.progress,
    );
    assert.equal(
      (await personnelReport(env, admin, "2020-01-01")).source,
      "missing",
    );
    await assert.rejects(personnelReport(env, admin, "2099-01-01"));
    await assert.rejects(personnelReport(env, admin, "2026-02-30"));
    const scoped = await personnelReport(env, staff, today);
    assert.ok(scoped.previousTasks.every((t) => t.assigneeId === staff.id));
    await updateMember(env, admin, staff.id, {
      ...staff,
      department: "Phòng Thiết kế",
      team: "Team A",
    });
    assert.equal(
      JSON.parse(
        (
          sql
            .prepare("SELECT data FROM members WHERE id=?")
            .get(staff.id) as any
        ).data,
      ).team,
      "Team A",
    );
    await assert.rejects(updateMember(env, staff, staff.id, staff), /quyền/);
    await assert.rejects(
      updateMember(env, admin, admin.id, { ...admin, role: "staff" }),
      /hạ quyền/,
    );
  } finally {
    sql.close();
  }
});
test("task metrics and day comparisons exclude unknown history and reassigned tasks", () => {
  const base = makeDemo().tasks[0],
    day = "2026-11-07";
  const before = [
    {
      ...base,
      id: "1",
      assigneeId: "a",
      weight: 2,
      progress: 50,
      status: "doing" as const,
      due: day,
      completedAt: "",
    },
  ];
  const tasks = [
    { ...before[0], progress: 100, status: "done" as const, completedAt: day },
    {
      ...base,
      id: "2",
      assigneeId: "a",
      weight: 2,
      progress: 50,
      status: "doing" as const,
      due: "2026-11-06",
      completedAt: "",
    },
  ];
  const m = personnelMetrics(tasks, day);
  assert.equal(m.done, 1);
  assert.equal(m.overdue, 1);
  assert.equal(m.progress, 75);
  assert.equal(m.onTime, 100);
  assert.equal(m.onTimeSample, 1);
  assert.ok(!("hours" in m));
  assert.deepEqual(taskMovement(tasks, before, true), {
    improved: 1,
    completed: 1,
    changed: 1,
  });
  assert.deepEqual(taskMovement(tasks, before, false), {
    improved: null,
    completed: null,
    changed: null,
  });
  assert.equal(
    taskMovement([{ ...tasks[0], assigneeId: "b" }], before, true).improved,
    0,
  );
  assert.equal(personnelMetrics([{ ...base, weight: 0 }], day).progress, null);
  assert.equal(personnelMetrics([], day).onTime, null);
});
