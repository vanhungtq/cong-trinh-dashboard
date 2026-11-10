import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo } from "../shared/demo";
import { officePerson, officePeople, officeRooms } from "../shared/office";
test("office status reflects assigned tasks rather than online presence", () => {
  const w = makeDemo(),
    p = w.people[0],
    t = {
      ...w.tasks[0],
      assigneeId: p.id,
      archived: false,
      due: "2099-01-01",
      completedAt: "",
      weight: 20,
    };
  assert.equal(officePerson(p, []).state, "idle");
  assert.equal(
    officePerson(p, [{ ...t, status: "todo", progress: 0 }]).state,
    "planned",
  );
  assert.equal(
    officePerson(p, [{ ...t, status: "doing", progress: 40 }]).state,
    "working",
  );
  assert.equal(officePerson(p, [{ ...t, status: "review" }]).state, "review");
  assert.equal(officePerson(p, [{ ...t, status: "blocked" }]).state, "blocked");
  assert.equal(
    officePerson(p, [{ ...t, status: "blocked", due: "2000-01-01" }]).state,
    "overdue",
  );
  assert.equal(
    officePerson(p, [{ ...t, status: "done", progress: 100 }]).state,
    "done",
  );
  assert.equal(
    officePerson(p, [{ ...t, status: "doing", archived: true }]).open,
    0,
  );
  assert.equal(
    officePerson(p, [{ ...t, assigneeId: "other" }]).tasks.length,
    0,
  );
});
test("office respects membership scope and splits large departments without losing staff", () => {
  const w = makeDemo(),
    admin = w.people.find((p) => p.role === "admin")!,
    staff = w.people.find((p) => p.role === "staff")!;
  assert.equal(officePeople(w, admin).length, w.people.length);
  assert.deepEqual(
    officePeople(w, staff).map((p) => p.id),
    [staff.id],
  );
  const manager = w.people.find((p) => p.role === "manager")!;
  w.people.push({ ...staff, id: "restricted", name: "Restricted" });
  w.tasks.push({
    ...w.tasks[0],
    id: "restricted",
    assigneeId: "restricted",
    projectId: w.projects.find((p) => p.managerId !== manager.id)!.id,
  });
  assert.ok(!officePeople(w, manager).some((p) => p.id === "restricted"));
  const people = Array.from({ length: 25 }, (_, i) =>
    officePerson(
      { ...staff, id: "p" + i, department: i < 20 ? "Thiết kế" : "" },
      [],
    ),
  );
  const rooms = officeRooms(people);
  assert.equal(rooms.flatMap((r) => r.people).length, 25);
  assert.ok(rooms.every((r) => r.people.length <= 8));
  assert.ok(rooms.some((r) => r.name === "Chưa phân phòng"));
  assert.equal(new Set(rooms.map((r) => r.id)).size, rooms.length);
});
