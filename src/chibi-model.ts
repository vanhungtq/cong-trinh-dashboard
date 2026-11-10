import * as THREE from "three";
export type ChibiPose = "seated" | "standing";
// All facial features and feet face local -Z, toward the seated user's monitor.
export const CHIBI_FORWARD_Z = -1;
export function createChibi(
  parent: THREE.Object3D,
  material: (color: string) => THREE.Material,
  color: string,
  variant: number,
  pose: ChibiPose,
) {
  const root = new THREE.Group();
  parent.add(root);
  root.userData.pose = pose;
  function shape(
    p: THREE.Object3D,
    g: THREE.BufferGeometry,
    c: string,
    x: number,
    y: number,
    z: number,
    name = "",
  ) {
    const m = new THREE.Mesh(g, material(c));
    m.position.set(x, y, z);
    m.name = name;
    m.castShadow = true;
    m.receiveShadow = true;
    p.add(m);
    return m;
  }
  const sphere = (
    p: THREE.Object3D,
    r: number,
    c: string,
    x: number,
    y: number,
    z: number,
    name = "",
  ) => shape(p, new THREE.SphereGeometry(r, 12, 10), c, x, y, z, name);
  const skin = ["#edc2a0", "#d8a37e", "#f3d3b5", "#c98f69"][variant % 4],
    hair = ["#584439", "#393837", "#775545", "#a47a52"][variant % 4];
  const seated = pose === "seated";
  const torso = shape(
    root,
    new THREE.CapsuleGeometry(0.21, 0.2, 4, 10),
    color,
    0,
    seated ? 0.85 : 0.76,
    0,
    "torso",
  );
  torso.scale.z = 0.8;
  const head = new THREE.Group();
  head.name = "head";
  head.position.set(0, seated ? 1.34 : 1.25, 0);
  root.add(head);
  sphere(head, 0.31, skin, 0, 0, 0, "skull");
  shape(
    head,
    new THREE.SphereGeometry(0.325, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.44),
    hair,
    0,
    0.02,
    0.015,
    "hair-cap",
  );
  const back = sphere(head, 0.24, hair, 0, 0.035, 0.13, "hair-back");
  back.scale.set(1.12, 1, 0.83);
  for (const x of [-0.29, 0.29]) sphere(head, 0.065, skin, x, -0.01, 0, "ear");
  const eyes: THREE.Group[] = [];
  for (const x of [-0.105, 0.105]) {
    const eye = new THREE.Group();
    eye.position.set(x, 0.008, -0.292);
    eye.name = x < 0 ? "left-eye" : "right-eye";
    head.add(eye);
    const pupil = sphere(eye, 0.028, "#27382f", 0, 0, 0);
    pupil.scale.y = 1.3;
    sphere(eye, 0.009, "#ffffff", -0.007, 0.012, -0.024);
    eyes.push(eye);
    sphere(head, 0.041, "#eaa6a0", x * 1.6, -0.075, -0.25, "cheek");
  }
  sphere(head, 0.036, "#d89f7d", 0, -0.045, -0.31, "nose");
  shape(
    head,
    new THREE.BoxGeometry(0.065, 0.012, 0.014),
    "#a96e58",
    0,
    -0.109,
    -0.292,
    "mouth",
  );
  for (let i = 0; i < 3; i++) {
    const bang = sphere(
      head,
      0.11,
      hair,
      (i - 1) * 0.13,
      0.16,
      -0.22,
      "fringe",
    );
    bang.scale.y = 0.65;
  }
  const hands: THREE.Object3D[] = [],
    arms: THREE.Group[] = [],
    legs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.24, seated ? 0.98 : 0.9, seated ? -0.12 : 0);
    root.add(arm);
    arms.push(arm);
    if (seated) {
      shape(
        arm,
        new THREE.CapsuleGeometry(0.07, 0.17, 3, 8),
        color,
        0,
        -0.035,
        -0.02,
      ).rotation.x = 0.7;
      hands.push(
        sphere(root, 0.075, skin, side * 0.2, 1.025, -0.3, "typing-hand"),
      );
    } else {
      shape(
        arm,
        new THREE.CapsuleGeometry(0.07, 0.16, 3, 8),
        color,
        0,
        -0.13,
        0,
      );
      hands.push(sphere(arm, 0.075, skin, 0, -0.29, -0.015));
    }
    const leg = new THREE.Group();
    leg.position.set(side * 0.13, seated ? 0.52 : 0.47, 0);
    root.add(leg);
    legs.push(leg);
    if (seated) {
      shape(
        leg,
        new THREE.CapsuleGeometry(0.07, 0.14, 3, 8),
        "#536a69",
        0,
        -0.065,
        -0.085,
      ).rotation.x = -0.65;
      sphere(leg, 0.095, "#3e5350", 0, -0.2, -0.2, "shoe");
    } else {
      shape(
        leg,
        new THREE.CapsuleGeometry(0.075, 0.16, 3, 8),
        "#536a69",
        0,
        -0.13,
        0,
      );
      const shoe = sphere(leg, 0.1, "#3e5350", 0, -0.32, -0.045, "shoe");
      shoe.scale.z = 1.3;
    }
  }
  return {
    root,
    head,
    torso,
    eyes,
    hands,
    leftArm: arms[0],
    rightArm: arms[1],
    leftLeg: legs[0],
    rightLeg: legs[1],
    pose,
  };
}
export type ChibiModel = ReturnType<typeof createChibi>;
