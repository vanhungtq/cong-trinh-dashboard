import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createChibi, CHIBI_FORWARD_Z } from "../src/chibi-model";
import { sampleOfficeActivity } from "../shared/office-activity";
test("chibi face, hair and seated hands use the same forward direction as the monitor", () => {
  const scene = new THREE.Group();
  const materials: THREE.Material[] = [];
  const material = (color: string) => {
    const m = new THREE.MeshStandardMaterial({ color });
    materials.push(m);
    return m;
  };
  try {
    for (const pose of ["seated", "standing"] as const) {
      const p = createChibi(scene, material, "#77a999", 2, pose);
      assert.equal(CHIBI_FORWARD_Z, -1);
      assert.ok(p.head.getObjectByName("nose")!.position.z < 0);
      assert.ok(p.head.getObjectByName("mouth")!.position.z < 0);
      assert.ok(p.head.getObjectByName("hair-back")!.position.z > 0);
      assert.equal(p.eyes.length, 2);
      assert.ok(p.eyes.every((e) => e.position.z < 0));
      assert.equal(p.pose, pose);
      const cap = p.head.getObjectByName(
        "hair-cap",
      ) as THREE.Mesh<THREE.SphereGeometry>;
      assert.ok(
        cap.geometry.parameters.thetaLength < Math.PI / 2,
        "Hair cap must leave the eyes uncovered",
      );
      if (pose === "seated") {
        assert.ok(p.hands.every((h) => h.position.z < 0));
        assert.ok(p.hands.every((h) => h.position.y > 1));
      }
    }
  } finally {
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    materials.forEach((m) => m.dispose());
  }
});
test("ambient routes cover walking, coffee and greetings without position jumps or desk intrusion", () => {
  const activities = new Set<string>();
  for (let t = 0; t < 84; t += 0.1) {
    const p = sampleOfficeActivity(t);
    activities.add(p.activity);
    assert.ok(p.x >= -3.151 && p.x <= 3.101);
    assert.ok(p.z >= 2.349 && p.z <= 2.651);
    assert.ok(Number.isFinite(p.yaw));
    const next = sampleOfficeActivity(t + 0.001);
    assert.ok(Math.hypot(next.x - p.x, next.z - p.z) < 0.005);
  }
  for (const state of ["walking", "brewing", "drinking", "waving", "resting"])
    assert.ok(activities.has(state));
  const start = sampleOfficeActivity(0),
    end = sampleOfficeActivity(42);
  assert.equal(start.x, end.x);
  assert.equal(start.z, end.z);
  assert.notDeepEqual(sampleOfficeActivity(3), sampleOfficeActivity(3, 21, 1));
});
