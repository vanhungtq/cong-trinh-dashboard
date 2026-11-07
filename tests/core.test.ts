import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo } from "../shared/demo";
import {
  csv,
  isOverdue,
  localDate,
  onTimeRate,
  projectProgress,
  totals,
} from "../shared/metrics";
import {
  documentSchema,
  projectSchema,
  receiptSchema,
} from "../worker/validation";
import { mapTrelloCard } from "../worker/providers";
const w = makeDemo(new Date("2026-11-07T03:00:00Z"));
test("weighted project progress is independent of card count", () => {
  const a = { ...w.tasks[0], weight: 80, progress: 25 },
    b = { ...w.tasks[1], weight: 20, progress: 100 };
  assert.equal(projectProgress([a, b]), 40);
  assert.equal(projectProgress([{ ...a, weight: 0 }]), 0);
});
test("Vietnam date boundary and overdue rules", () => {
  assert.equal(localDate(new Date("2026-11-06T18:00:00Z")), "2026-11-07");
  assert.equal(
    isOverdue(
      { ...w.tasks[0], status: "doing", due: "2026-11-06" },
      "2026-11-07",
    ),
    true,
  );
  assert.equal(
    isOverdue(
      { ...w.tasks[0], status: "done", due: "2026-11-06" },
      "2026-11-07",
    ),
    false,
  );
  assert.equal(
    isOverdue(
      { ...w.tasks[0], status: "doing", due: "2026-11-07" },
      "2026-11-07",
    ),
    false,
  );
});
test("financial totals keep cash, accepted value and due payments distinct", () => {
  const t = totals(w.projects, w.receipts, w.terms, "2026-11-07");
  assert.equal(t.contract, 4440000000);
  assert.equal(t.received, 1468000000);
  assert.equal(t.accepted, 2084000000);
  assert.equal(t.overdue, 250000000);
});
test("on-time metric excludes unknown historical completion dates", () => {
  assert.equal(
    onTimeRate([{ ...w.tasks[0], status: "done", completedAt: "" }]),
    null,
  );
  assert.equal(
    onTimeRate([
      {
        ...w.tasks[0],
        status: "done",
        completedAt: "2026-11-06",
        due: "2026-11-07",
      },
    ]),
    100,
  );
});
test("Trello import preserves weights and does not invent completion history", () => {
  const card = {
    id: "123",
    name: "Task",
    idList: "a",
    idMembers: [],
    due: "2026-11-06T20:00:00Z",
    url: "https://trello.com/c/123",
    closed: false,
  };
  const t = mapTrelloCard(card, "p", { a: "done" }, []);
  assert.equal(t.completedAt, "");
  assert.equal(t.weight, 0);
  assert.equal(t.progress, 100);
  assert.equal(t.due, "2026-11-07");
  const next = mapTrelloCard(card, "p", { a: "doing" }, [], {
    ...t,
    weight: 45,
    progress: 100,
  });
  assert.equal(next.weight, 45);
  assert.equal(next.progress, 99);
});
test("invalid dates, negative receipts and non-Drive links rejected", () => {
  assert.equal(
    receiptSchema.safeParse({
      projectId: "p",
      amount: -1,
      date: "2026-11-07",
      reference: "PT",
    }).success,
    false,
  );
  assert.equal(
    receiptSchema.safeParse({
      projectId: "p",
      amount: 1,
      date: "2026-02-30",
      reference: "PT",
    }).success,
    false,
  );
  assert.equal(
    projectSchema.safeParse({
      ...w.projects[0],
      start: "2026-11-07",
      due: "2026-11-01",
    }).success,
    false,
  );
  assert.equal(
    documentSchema.safeParse({
      projectId: "p",
      name: "a",
      category: "a",
      version: "1",
      status: "a",
      url: "https://drive.google.com.evil.test/a",
    }).success,
    false,
  );
});
test("CSV quotes cells and neutralizes spreadsheet formulas", () => {
  assert.match(
    csv([['=HYPERLINK("x")', "hello,world"]]),
    /"'=HYPERLINK\(""x""\)"/,
  );
  assert.match(csv([["hello,world"]]), /"hello,world"/);
});
