import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo, demoPersonnelReport, demoBoards } from "../shared/demo";
import { personnelMetrics, taskMovement } from "../shared/personnel";
const now = new Date("2026-11-07T03:00:00Z"),
  w = makeDemo(now);
test("demo covers app entities, fiscal situations and task warning states coherently", () => {
  assert.equal(w.projects.length, 6);
  assert.ok(new Set(w.people.map((p) => p.department)).size >= 4);
  assert.ok(new Set(w.people.map((p) => p.team)).size >= 4);
  for (const status of ["todo", "doing", "review", "blocked", "done"])
    assert.ok(w.tasks.some((t) => t.status === status));
  assert.ok(w.tasks.some((t) => !t.assigneeId && t.weight === 0));
  assert.ok(w.tasks.some((t) => t.archived));
  assert.ok(w.terms.some((t) => t.received === t.amount));
  assert.ok(w.terms.some((t) => t.received > 0 && t.received < t.amount));
  assert.ok(w.terms.some((t) => !t.received && t.due < "2026-11-07"));
  for (const t of w.terms)
    assert.ok(
      t.received <=
        w.receipts
          .filter((r) => r.projectId === t.projectId)
          .reduce((s, r) => s + r.amount, 0),
    );
  for (const r of w.receipts)
    assert.ok(r.date >= w.projects.find((p) => p.id === r.projectId)!.start);
  for (const d of w.documents) {
    assert.ok(w.projects.some((p) => p.id === d.projectId));
    assert.equal(d.url, "");
  }
  assert.ok(w.documents.length >= 24);
  const boards = demoBoards(w);
  for (const b of boards)
    for (const l of b.lists) assert.ok(w.settings.listMapping[l.id]);
});
test("demo history supports meaningful automatic daily comparisons and bounds unavailable dates", () => {
  const today = demoPersonnelReport(w, "2026-11-07", now),
    previous = demoPersonnelReport(w, "2026-11-06", now);
  assert.deepEqual(today.tasks, w.tasks);
  assert.equal(today.previousAvailable, true);
  assert.deepEqual(today.previousTasks, previous.tasks);
  const m = personnelMetrics(today.tasks, "2026-11-07");
  assert.equal(m.done, 3);
  assert.equal(m.onTime, 67);
  assert.equal(m.onTimeSample, 3);
  const movement = taskMovement(today.tasks, today.previousTasks, true);
  assert.ok(movement.improved! > 0);
  assert.equal(movement.completed, 3);
  assert.ok(movement.changed! >= 3);
  assert.equal(demoPersonnelReport(w, "2026-10-01", now).source, "missing");
  assert.equal(demoPersonnelReport(w, "2026-11-08", now).source, "missing");
  for (let i = 0; i < 14; i++) {
    const d = new Date(Date.parse("2026-11-07T00:00:00Z") - 86400000 * i)
      .toISOString()
      .slice(0, 10);
    const r = demoPersonnelReport(w, d, now);
    for (const t of r.tasks) {
      if (t.status === "done") assert.ok(!t.completedAt || t.completedAt <= d);
      assert.ok(t.progress >= 0 && t.progress <= 100);
    }
  }
});
