import { createChibi, type ChibiModel } from "./chibi-model";
import { sampleOfficeActivity } from "../shared/office-activity";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  officeStates,
  type OfficeRoom,
  type OfficeState,
} from "../shared/office";
export function createOfficeScene(
  host: HTMLElement,
  rooms: OfficeRoom[],
  select: (id: string) => void,
  onError: (message: string) => void,
) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor("#eef3ef");
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement;
  canvas.setAttribute(
    "aria-label",
    "Văn phòng 3D; có thể chọn nhân sự bằng danh sách bên cạnh.",
  );
  host.appendChild(canvas);
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.minPolarAngle = 0.18;
  controls.minDistance = 5;
  controls.maxDistance = 90;
  controls.enablePan = true;
  scene.add(new THREE.HemisphereLight("#fff7ea", "#c0cfc6", 1.8));
  const sun = new THREE.DirectionalLight("#fff4df", 2.2);
  sun.position.set(7, 16, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 22;
  sun.shadow.camera.bottom = -22;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const textures: THREE.Texture[] = [];
  const sceneLabels: { sprite: THREE.Sprite; width: number }[] = [];
  let focusedPerson = "";
  const material = (color: string) => {
    if (!materials.has(color))
      materials.set(
        color,
        new THREE.MeshStandardMaterial({ color, roughness: 0.83 }),
      );
    return materials.get(color)!;
  };
  function mesh(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    color: string,
    x: number,
    y: number,
    z: number,
  ) {
    const m = new THREE.Mesh(geometry, material(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  const box = (
    p: THREE.Object3D,
    w: number,
    h: number,
    d: number,
    c: string,
    x: number,
    y: number,
    z: number,
  ) => mesh(p, new THREE.BoxGeometry(w, h, d), c, x, y, z);
  const ball = (
    p: THREE.Object3D,
    r: number,
    c: string,
    x: number,
    y: number,
    z: number,
  ) => mesh(p, new THREE.SphereGeometry(r, 12, 10), c, x, y, z);
  function label(
    parent: THREE.Object3D,
    text: string,
    x: number,
    y: number,
    z: number,
    width = 2.5,
    bg = "#ffffff",
    fg = "#254b3c",
  ) {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 96;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(0, 0, 640, 96, 22);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.font = "600 29px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 320, 50, 610);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, depthTest: false }),
    );
    sprite.position.set(x, y, z);
    sprite.scale.set(width, width * 0.15, 1);
    sprite.renderOrder = 5;
    parent.add(sprite);
    sprite.userData.labelKind = "decor";
    sceneLabels.push({ sprite, width });
    return sprite;
  }
  function plant(parent: THREE.Object3D, x: number, z: number) {
    mesh(
      parent,
      new THREE.CylinderGeometry(0.22, 0.16, 0.36, 10),
      "#d6bda2",
      x,
      0.3,
      z,
    );
    for (let i = 0; i < 5; i++) {
      const leaf = ball(
        parent,
        0.24,
        i % 2 ? "#72a77b" : "#4b8b64",
        x + Math.sin(i * 1.9) * 0.14,
        0.72 + (i % 2) * 0.2,
        z + Math.cos(i * 1.9) * 0.14,
      );
      leaf.scale.set(0.65, 1.6, 0.75);
    }
  }
  const stations = new Map<string, THREE.Group>();
  const pickable: THREE.Object3D[] = [];
  const animations: {
    model: ChibiModel;
    phase: number;
    state: OfficeState;
  }[] = [];
  function employee(
    parent: THREE.Group,
    p: OfficeRoom["people"][number],
    x: number,
    z: number,
    color: string,
    index: number,
  ) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.userData.personId = p.person.id;
    stations.set(p.person.id, g);
    parent.add(g);
    box(g, 1.65, 0.12, 0.88, "#dbb995", 0, 0.98, -0.68);
    for (const xx of [-0.65, 0.65])
      for (const zz of [-0.95, -0.39])
        box(g, 0.075, 0.85, 0.075, "#c7d5ce", xx, 0.5, zz);
    box(g, 0.67, 0.46, 0.075, "#405954", 0, 1.31, -0.83);
    box(g, 0.58, 0.36, 0.012, "#a8d6d3", 0, 1.31, -0.784);
    box(g, 0.08, 0.16, 0.08, "#657b72", 0, 1.05, -0.83);
    box(g, 0.4, 0.025, 0.17, "#f0ede2", 0, 1.06, -0.4);
    box(g, 0.13, 0.025, 0.12, "#f0ede2", 0.48, 1.06, -0.39);
    box(g, 0.5, 0.1, 0.45, color, 0, 0.55, 0.03);
    box(g, 0.5, 0.5, 0.1, color, 0, 0.84, 0.3);
    mesh(
      g,
      new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8),
      "#697e74",
      0,
      0.28,
      0.05,
    );
    box(g, 0.6, 0.04, 0.08, "#697e74", 0, 0.08, 0.05);
    box(g, 0.08, 0.04, 0.6, "#697e74", 0, 0.08, 0.05);
    const hash = [...p.person.id].reduce((sum, c) => sum + c.charCodeAt(0), 0);
    const model = createChibi(g, material, color, hash, "seated");
    const stateColor = officeStates[p.state].color;
    const ring = mesh(
      g,
      new THREE.TorusGeometry(0.4, 0.025, 6, 28),
      stateColor,
      0,
      0.13,
      0.03,
    );
    ring.rotation.x = Math.PI / 2;
    label(g, p.person.name, 0, 1.99, 0, 1.7, "#ffffff", "#294b3c");
    label(
      g,
      officeStates[p.state].label,
      0,
      1.75,
      0,
      1.65,
      stateColor,
      "#ffffff",
    );
    g.traverse((o) => {
      if (o instanceof THREE.Sprite) o.userData.labelKind = "person";
      if (o instanceof THREE.Mesh || o instanceof THREE.Sprite)
        pickable.push(o);
    });
    animations.push({ model, phase: index * 0.9, state: p.state });
  }

  const ambient: {
    group: THREE.Group;
    model: ChibiModel;
    cup: THREE.Group;
    offset: number;
    lane: number;
    roomIndex: number;
    labels: Map<string, THREE.Sprite>;
  }[] = [];
  const steam: {
    group: THREE.Group;
    points: THREE.Object3D[];
    roomIndex: number;
  }[] = [];
  const clocks: { hour: THREE.Group; minute: THREE.Group }[] = [];
  let showActivities = true;
  function mug(parent: THREE.Object3D, x: number, y: number, z: number) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    mesh(
      g,
      new THREE.CylinderGeometry(0.065, 0.05, 0.13, 10),
      "#f7eedc",
      0,
      0,
      0,
    );
    mesh(
      g,
      new THREE.CylinderGeometry(0.053, 0.053, 0.005, 10),
      "#76513c",
      0,
      0.068,
      0,
    );
    mesh(
      g,
      new THREE.TorusGeometry(0.038, 0.012, 6, 12),
      "#f7eedc",
      0.066,
      0,
      0,
    );
    return g;
  }
  function decorate(group: THREE.Group, room: OfficeRoom, index: number) {
    // Art, clock, bookcase, plants and a task board with actual room totals.
    box(group, 1.15, 1.1, 0.08, "#d2b78f", -2.65, 1.5, -3.48);
    box(group, 0.99, 0.94, 0.02, "#f6eee0", -2.65, 1.5, -3.42);
    const art = ball(group, 0.27, room.color, -2.65, 1.56, -3.38);
    art.scale.z = 0.08;
    box(group, 0.65, 0.09, 0.025, "#b9c995", -2.65, 1.2, -3.36);
    const clock = new THREE.Group();
    clock.position.set(-0.85, 1.65, -3.42);
    group.add(clock);
    mesh(clock, new THREE.TorusGeometry(0.3, 0.028, 8, 24), "#647e72", 0, 0, 0);
    const face = mesh(
      clock,
      new THREE.CircleGeometry(0.29, 24),
      "#faf5e8",
      0,
      0,
      -0.01,
    );
    face.castShadow = false;
    const hour = new THREE.Group(),
      minute = new THREE.Group();
    clock.add(hour, minute);
    box(hour, 0.025, 0.16, 0.015, "#475e53", 0, 0.07, 0.025);
    box(minute, 0.018, 0.24, 0.012, "#475e53", 0, 0.11, 0.035);
    ball(clock, 0.028, "#bca477", 0, 0, 0.045);
    clocks.push({ hour, minute });
    label(
      group,
      `${room.people.reduce((sum, p) => sum + p.open, 0)} việc mở · ${room.people.reduce((sum, p) => sum + p.overdue, 0)} quá hạn`,
      1.8,
      1.9,
      -3.35,
      3,
      "#f5f6eb",
      "#54705a",
    );
    box(group, 0.85, 1.2, 0.42, "#aabd9d", -4.05, 0.64, 1.0);
    for (const yy of [0.15, 0.52, 0.9]) {
      box(group, 0.75, 0.045, 0.46, "#f3e5cc", -4.05, yy, 1.0);
      for (let k = 0; k < 5; k++)
        box(
          group,
          0.085,
          0.24,
          0.22,
          ["#b18a80", "#7da19b", "#d1bd8a"][k % 3],
          -4.32 + k * 0.13,
          yy + 0.14,
          1.0,
        );
    }
    // Coffee bar, espresso machine, cups and animated steam.
    box(group, 1.95, 0.84, 0.55, "#c0cdb9", -3.38, 0.46, 3.08);
    box(group, 2.06, 0.1, 0.68, "#ead2ac", -3.38, 0.93, 3.08);
    for (const x of [-3.8, -2.96])
      box(group, 0.79, 0.53, 0.025, "#b1c2ab", x, 0.49, 2.79);
    box(group, 0.55, 0.62, 0.42, "#485f57", -3.65, 1.28, 3.07);
    box(group, 0.37, 0.26, 0.03, "#9eafa4", -3.65, 1.21, 2.84);
    box(group, 0.23, 0.1, 0.1, "#e8cdaa", -3.65, 1.52, 2.81);
    mug(group, -3.65, 1.015, 2.89);
    mug(group, -2.95, 1.02, 3.05);
    label(group, "COFFEE BREAK", -3.38, 1.88, 3.1, 1.65, "#e8d9bb", "#705d42");
    const mist = new THREE.Group();
    group.add(mist);
    const points = [];
    for (let k = 0; k < 4; k++) {
      const puff = ball(mist, 0.035, "#dbe7e0", -3.65, 1.66 + k * 0.08, 2.83);
      puff.castShadow = false;
      points.push(puff);
    }
    steam.push({ group: mist, points, roomIndex: index });
    // Shared printer and paper trays are separate from the personal desks.
    box(group, 0.85, 0.55, 0.55, "#bac8b5", 3.15, 0.32, 3.03);
    box(group, 0.72, 0.26, 0.52, "#e9ede1", 3.15, 0.73, 3.03);
    box(group, 0.54, 0.045, 0.3, "#738879", 3.15, 0.9, 3.0);
    box(group, 0.42, 0.018, 0.29, "#fcf8ed", 3.15, 0.93, 3.0);
    if (room.people.length <= 4) {
      // Use the free front half for a small lounge; leave a clear walking lane.
      box(group, 2.9, 0.035, 1.65, "#c7d4c0", 0.25, 0.085, 0.85);
      box(group, 1.45, 0.12, 0.8, "#dcbf97", -0.1, 0.67, 0.8);
      for (const xx of [-0.65, 0.45])
        box(group, 0.08, 0.57, 0.08, "#829782", xx, 0.36, 0.8);
      box(group, 0.35, 0.025, 0.28, "#f3eee0", -0.35, 0.75, 0.75);
      mug(group, 0.2, 0.8, 0.8);
      box(group, 0.6, 0.35, 1.65, room.color, 2.15, 0.38, 0.8);
      box(group, 0.16, 0.7, 1.65, room.color, 2.43, 0.65, 0.8);
      for (const zz of [0.2, 0.8, 1.4])
        box(group, 0.52, 0.1, 0.51, "#dde5cf", 2.09, 0.61, zz);
      plant(group, 3.75, 0.55);
    }
    // Decorative staff never carry real person IDs and are not added to picking/stats.
    const count = index < 2 ? 2 : 1;
    for (let j = 0; j < count; j++) {
      const actor = new THREE.Group();
      actor.name = "ambient-employee";
      actor.userData.decorative = true;
      group.add(actor);
      const model = createChibi(
        actor,
        material,
        j ? "#b79bc7" : "#9fb89a",
        index * 3 + j,
        "standing",
      );
      const cup = mug(model.rightArm, 0, -0.29, -0.07);
      cup.visible = false;
      label(actor, "NPC · Nhân viên ảo", 0, 1.98, 0, 1.7, "#f2dfb5", "#775e31");
      const labels = new Map<string, THREE.Sprite>();
      for (const [key, title] of Object.entries({
        walking: "Đi dạo",
        brewing: "Pha cà phê",
        drinking: "Uống cà phê",
        waving: "Chào đồng nghiệp",
        resting: "Nghỉ một chút",
      })) {
        const badge = label(
          actor,
          title,
          0,
          1.74,
          0,
          1.6,
          "#f9f3e5",
          "#907a53",
        );
        badge.visible = false;
        labels.set(key, badge);
      }
      const offset = index * 8 + j * 21;
      const initial = sampleOfficeActivity(0, offset, j);
      actor.position.set(initial.x, 0.09, initial.z);
      actor.rotation.y = initial.yaw;
      labels.get(initial.activity)!.visible = true;
      actor.traverse((o) => {
        if (o instanceof THREE.Sprite) o.userData.labelKind = "ambient";
      });
      ambient.push({
        group: actor,
        model,
        cup,
        offset,
        lane: j,
        roomIndex: index,
        labels,
      });
    }
  }
  const center = new THREE.Group();
  scene.add(center);
  rooms.forEach((room, i) => {
    const group = new THREE.Group();
    group.position.set((i % 2) * 10.4, 0, Math.floor(i / 2) * 8.4);
    center.add(group);
    box(group, 9.6, 0.22, 7.5, "#d5dfd4", 0, -0.12, 0);
    box(group, 9.35, 0.06, 7.25, i % 2 ? "#e7e3d8" : "#dfebe4", 0, 0.02, 0);
    box(group, 9.4, 1.0, 0.13, room.color, 0, 0.53, -3.62);
    box(group, 0.13, 0.58, 7.2, "#bacfc2", -4.65, 0.3, 0);
    box(group, 2.8, 0.8, 0.1, "#c3e3e3", 1.8, 1.05, -3.51);
    for (const x of [0.42, 1.8, 3.18])
      box(group, 0.06, 0.84, 0.11, "#edf2e9", x, 1.05, -3.44);
    label(
      group,
      room.name + (room.part > 1 ? " · Khu " + room.part : ""),
      0,
      2.7,
      -3.55,
      5,
      room.color,
      "#ffffff",
    );
    plant(group, -4.05, -2.8);
    plant(group, 4.1, 2.9);

    room.people.forEach((p, j) =>
      employee(
        group,
        p,
        (j % 4) * 2.05 - 3.1,
        Math.floor(j / 4) * 2.65 - 0.9,
        room.color,
        j + i * 8,
      ),
    );
    decorate(group, room, i);
  });
  const bounds = new THREE.Box3().setFromObject(center);
  const mid = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  center.position.sub(new THREE.Vector3(mid.x, 0, mid.z));
  const radius = Math.max(6, Math.sqrt(size.x ** 2 + size.z ** 2) / 2);
  const direction = new THREE.Vector3(0.8, 1.0, 1.0).normalize();
  function reset() {
    focusedPerson = "";
    const ratio = host.clientWidth / Math.max(host.clientHeight, 1);
    const fov = THREE.MathUtils.degToRad(38);
    const angle = Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * ratio));
    camera.position.copy(
      direction.clone().multiplyScalar((radius / Math.sin(angle / 2)) * 0.87),
    );
    controls.target.set(0, 0.4, 0);
    controls.update();
  }
  function resize() {
    const width = host.clientWidth,
      height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    reset();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  reset();
  let stopped = false,
    frame = 0,
    previous = 0;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  function tick(t: number) {
    if (stopped) return;
    frame = requestAnimationFrame(tick);
    if (document.hidden || t - previous < 32) return;
    previous = t;
    controls.update();

    const seconds = t / 1000;
    animations.forEach((a) => {
      const active = a.state === "working" || a.state === "review";
      if (!reduce.matches) {
        a.model.head.rotation.x = active
          ? -0.025 + Math.sin(seconds * 2 + a.phase) * 0.035
          : Math.sin(seconds * 0.9 + a.phase) * 0.015;
        a.model.head.rotation.y = Math.sin(seconds * 0.7 + a.phase) * 0.025;
        a.model.torso.scale.y = 1 + Math.sin(seconds * 2 + a.phase) * 0.012;
        const blink = (seconds + a.phase) % 4.8 < 0.12 ? 0.08 : 1;
        a.model.eyes.forEach((e) => (e.scale.y = blink));
        a.model.hands.forEach((h, j) => {
          h.position.y =
            1.025 + (active ? Math.sin(seconds * 9 + a.phase + j) * 0.018 : 0);
        });
      }
    });
    const brewingRooms = new Set<number>();
    ambient.forEach((a) => {
      if (!showActivities || reduce.matches) return;
      const point = sampleOfficeActivity(seconds, a.offset, a.lane);
      a.group.position.set(
        point.x,
        0.09 +
          (point.activity === "walking"
            ? Math.abs(Math.sin(seconds * 8 + a.offset)) * 0.035
            : 0),
        point.z,
      );
      let diff = point.yaw - a.group.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      a.group.rotation.y += diff * 0.18;
      const walk = point.activity === "walking",
        swing = walk ? Math.sin(seconds * 8 + a.offset) * 0.45 : 0;
      a.model.leftLeg.rotation.x = swing;
      a.model.rightLeg.rotation.x = -swing;
      a.model.leftArm.rotation.x = -swing * 0.7;
      a.model.rightArm.rotation.x = swing * 0.7;
      a.model.rightArm.rotation.z = 0;
      a.model.leftArm.position.z = 0;
      a.model.rightArm.position.z = 0;
      if (point.activity === "brewing") {
        a.model.leftArm.rotation.x = 1.2 + Math.sin(seconds * 3) * 0.12;
        a.model.rightArm.rotation.x = 1.4;
        a.model.leftArm.position.z = -0.12;
        a.model.rightArm.position.z = -0.12;
        brewingRooms.add(a.roomIndex);
      }
      if (point.activity === "drinking") {
        a.model.rightArm.rotation.x = 2.65 + Math.sin(seconds * 1.6) * 0.1;
        a.model.head.rotation.x = -0.08;
      } else
        a.model.head.rotation.x = Math.sin(seconds * 1.3 + a.offset) * 0.025;
      if (point.activity === "waving") {
        a.model.rightArm.rotation.z = -2.3 + Math.sin(seconds * 7) * 0.25;
      }
      a.cup.visible = point.activity === "drinking";
      a.model.eyes.forEach(
        (e) => (e.scale.y = (seconds + a.offset) % 4.6 < 0.12 ? 0.08 : 1),
      );
      a.labels.forEach(
        (badge, key) => (badge.visible = key === point.activity),
      );
    });
    steam.forEach((s) => {
      s.group.visible =
        showActivities && !reduce.matches && brewingRooms.has(s.roomIndex);
      s.points.forEach((p, k) => {
        p.position.y = 1.62 + ((seconds * 0.2 + k * 0.1) % 0.38);
        p.position.x = -3.65 + Math.sin(seconds * 2 + k) * 0.022;
        p.scale.setScalar(0.6 + ((seconds * 0.2 + k * 0.1) % 0.38));
      });
    });
    const date = new Date();
    const hour = (date.getUTCHours() + 7) % 12,
      minute = date.getUTCMinutes();
    clocks.forEach((c) => {
      c.hour.rotation.z = (-(hour + minute / 60) * Math.PI) / 6;
      c.minute.rotation.z = (-minute * Math.PI) / 30;
    });
    // Keep labels readable without allowing near-camera room signs to cover faces.
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    const point = new THREE.Vector3();
    sceneLabels.forEach(({ sprite, width }) => {
      if (sprite.userData.labelKind === "decor")
        sprite.visible = !focusedPerson;
      sprite.getWorldPosition(point);
      point.applyMatrix4(camera.matrixWorldInverse);
      const pixels = sprite.userData.labelKind === "decor" ? 180 : 145;
      const maxWorld =
        (pixels *
          2 *
          Math.max(0.2, -point.z) *
          Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) /
        Math.max(1, host.clientHeight);
      const actual = Math.min(width, maxWorld);
      sprite.scale.set(actual, actual * 0.15, 1);
    });
    renderer.render(scene, camera);
  }
  const ray = new THREE.Raycaster(),
    pointer = new THREE.Vector2();
  let start = { x: 0, y: 0 };
  const down = (e: PointerEvent) => {
    start = { x: e.clientX, y: e.clientY };
  };
  const up = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      (-(e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    ray.setFromCamera(pointer, camera);
    for (const hit of ray.intersectObjects(pickable, false)) {
      let o: THREE.Object3D | null = hit.object;
      while (o && !o.userData.personId) o = o.parent;
      if (o?.userData.personId) {
        select(o.userData.personId);
        break;
      }
    }
  };
  const lost = (e: Event) => {
    e.preventDefault();
    onError(
      "Trình duyệt đã tạm ngừng đồ họa 3D. Bạn vẫn có thể xem công việc trong danh sách nhân sự.",
    );
  };
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("webglcontextlost", lost);
  frame = requestAnimationFrame(tick);
  return {
    setActivities(visible: boolean) {
      showActivities = visible;
      ambient.forEach((a) => (a.group.visible = visible));
      steam.forEach((s) => (s.group.visible = visible));
    },
    focus(id: string) {
      const station = stations.get(id);
      if (!station) return;
      focusedPerson = id;
      scene.updateMatrixWorld(true);
      const target = station.getWorldPosition(new THREE.Vector3());
      target.y = 0.8;
      controls.target.copy(target);
      camera.position.copy(
        target
          .clone()
          .add(
            new THREE.Vector3(0.8, 1, -1)
              .normalize()
              .multiplyScalar(Math.max(6.8, 6.8 / camera.aspect)),
          ),
      );
      controls.update();
    },
    reset,
    zoom: (factor: number) => {
      camera.position
        .sub(controls.target)
        .multiplyScalar(factor)
        .add(controls.target);
      controls.update();
    },
    dispose() {
      stopped = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("webglcontextlost", lost);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
        if (o instanceof THREE.Sprite) o.material.dispose();
      });
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
