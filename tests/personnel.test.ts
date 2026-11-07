import test from "node:test";
import assert from "node:assert/strict";
import { database } from "./database";
import { makeDemo } from "../shared/demo";
import {
  capturePersonnel,
  personnelReport,
  saveDailyLog,
  updateMember,
} from "../worker/personnel";
import { personnelMetrics } from "../shared/personnel";
import { localDate } from "../shared/metrics";
import type { Env } from "../worker/index";

test("personnel snapshots preserve historical state and reports enforce role scope", async () => {
  const { sql, binding } = database();
  const w = makeDemo(),
    env = { DB: binding } as Env;
  const today = localDate();
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
    assert.equal(all.source, "current");
    assert.equal(all.tasks.length, w.tasks.length);
    const scoped = await personnelReport(env, staff, today);
    assert.ok(scoped.tasks.every((t) => t.assigneeId === staff.id));
    const managed = await personnelReport(env, manager, today);
    const ids = w.projects
      .filter((p) => p.managerId === manager.id)
      .map((p) => p.id);
    assert.ok(managed.tasks.every((t) => ids.includes(t.projectId)));
    await capturePersonnel(env);
    assert.equal(
      (
        sql
          .prepare("SELECT count(*) AS n FROM personnel_snapshots")
          .get() as any
      ).n,
      w.tasks.length,
    );
    // Freeze the snapshot under a past date, then change today's task state.
    const past = "2020-01-01";
    sql.prepare("UPDATE personnel_snapshots SET day=?").run(past);
    sql.prepare("UPDATE personnel_days SET day=?").run(past);
    const task = w.tasks[0];
    sql
      .prepare(
        "UPDATE tasks SET data=json_set(data,'$.progress',99) WHERE id=?",
      )
      .run(task.id);
    const historic = await personnelReport(env, admin, past);
    assert.equal(historic.source, "snapshot");
    assert.equal(
      historic.tasks.find((t) => t.id === task.id)!.progress,
      task.progress,
    );
    assert.equal(
      (await personnelReport(env, admin, "2020-01-02")).source,
      "missing",
    );
    await assert.rejects(personnelReport(env, admin, "2099-01-01"));
    await assert.rejects(personnelReport(env, admin, "2026-02-30"));
    const own = w.tasks.find((t) => t.assigneeId === staff.id)!;
    const second = { ...own, id: "second-log-task" };
    sql
      .prepare("INSERT INTO tasks VALUES (?,?,?)")
      .run(second.id, second.projectId, JSON.stringify(second));
    const data = {
      day: today,
      taskId: own.id,
      hours: 20,
      progress: 50,
      done: "Đã hoàn thành khảo sát",
      plan: "Rà soát hồ sơ",
      blockers: "",
    };
    await saveDailyLog(env, staff, data);
    await saveDailyLog(env, staff, { ...data, hours: 19 }); // Update the same report, not an extra record.
    assert.equal(
      (sql.prepare("SELECT count(*) AS n FROM personnel_logs").get() as any).n,
      1,
    );
    await assert.rejects(
      saveDailyLog(env, staff, { ...data, taskId: second.id, hours: 6 }),
      /24 giờ/,
    );
    assert.equal(
      (sql.prepare("SELECT count(*) AS n FROM personnel_logs").get() as any).n,
      1,
    );
    await assert.rejects(saveDailyLog(env, admin, data), /được giao/);
    await assert.rejects(
      saveDailyLog(env, staff, { ...data, day: "2099-01-01" }),
    );
    // Self reports never change the manager-confirmed progress.
    assert.equal(
      JSON.parse(
        (sql.prepare("SELECT data FROM tasks WHERE id=?").get(own.id) as any)
          .data,
      ).progress,
      own.progress,
    );
    const other =
      w.people.find((p) => p.role === "staff" && p.id !== staff.id) || admin;
    assert.equal(
      (await personnelReport(env, other, today)).logs.filter(
        (l) => l.memberId === staff.id,
      ).length,
      other.role === "admin" ? 1 : 0,
    );
    // A backdated self report remains visible even without a snapshot for that date.
    await saveDailyLog(env, staff, { ...data, day: "2020-01-02", hours: 2 });
    const missing = await personnelReport(env, staff, "2020-01-02");
    assert.equal(missing.source, "missing");
    assert.equal(missing.logs.length, 1);
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
test("personnel metrics distinguish throughput, confirmed progress, on-time samples and reported hours", () => {
  const w = makeDemo(),
    base = w.tasks[0];
  const day = "2026-11-07";
  const tasks = [
    {
      ...base,
      id: "1",
      weight: 2,
      progress: 100,
      status: "done" as const,
      due: day,
      completedAt: day,
    },
    {
      ...base,
      id: "2",
      weight: 2,
      progress: 50,
      status: "doing" as const,
      due: "2026-11-06",
      completedAt: "",
    },
    {
      ...base,
      id: "3",
      weight: 0,
      progress: 100,
      status: "done" as const,
      due: day,
      completedAt: "",
    },
  ];
  const m = personnelMetrics(tasks, [], day);
  assert.equal(m.done, 1);
  assert.equal(m.overdue, 1);
  assert.equal(m.progress, 75);
  assert.equal(m.onTime, 100);
  assert.equal(m.onTimeSample, 1);
  assert.equal(m.hours, 0);
  assert.equal(
    personnelMetrics([{ ...base, weight: 0 }], [], day).progress,
    null,
  );
  assert.equal(personnelMetrics([], [], day).onTime, null);
});
