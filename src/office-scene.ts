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
    head: THREE.Object3D;
    hands: THREE.Object3D[];
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
    const hash = [...p.person.id].reduce((s, c) => s + c.charCodeAt(0), 0);
    const skin = ["#edc2a0", "#d8a37e", "#f3d3b5", "#c98f69"][hash % 4];
    const hair = ["#584439", "#393837", "#775545", "#a47a52"][hash % 4];
    const torso = mesh(
      g,
      new THREE.CapsuleGeometry(0.21, 0.2, 4, 10),
      color,
      0,
      0.85,
      0.02,
    );
    torso.scale.z = 0.8;
    const head = new THREE.Group();
    head.position.set(0, 1.34, 0);
    g.add(head);
    ball(head, 0.31, skin, 0, 0, 0);
    mesh(
      head,
      new THREE.SphereGeometry(
        0.325,
        14,
        10,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.55,
      ),
      hair,
      0,
      0.02,
      -0.015,
    );
    for (const xx of [-0.29, 0.29]) ball(head, 0.065, skin, xx, -0.01, 0);
    for (const xx of [-0.105, 0.105]) {
      const eye = ball(head, 0.029, "#283a33", xx, 0.005, 0.292);
      eye.scale.y = 1.3;
      ball(head, 0.043, "#eaa6a0", xx * 1.6, -0.075, 0.25);
    }
    box(head, 0.08, 0.018, 0.02, "#a76d53", 0, -0.105, 0.292);
    for (let i = 0; i < 3; i++) {
      const bang = ball(head, 0.11, hair, (i - 1) * 0.13, 0.16, 0.22);
      bang.scale.y = 0.65;
    }
    const hands: THREE.Object3D[] = [];
    for (const xx of [-0.2, 0.2]) {
      const arm = mesh(
        g,
        new THREE.CapsuleGeometry(0.07, 0.21, 3, 8),
        color,
        xx,
        0.93,
        -0.12,
      );
      arm.rotation.x = -0.7;
      hands.push(ball(g, 0.075, skin, xx, 1.025, -0.3));
      box(g, 0.12, 0.25, 0.14, "#536a69", xx * 0.65, 0.44, 0.05);
      ball(g, 0.09, "#3e5350", xx * 0.65, 0.32, 0.16);
    }
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
      if (o instanceof THREE.Mesh || o instanceof THREE.Sprite)
        pickable.push(o);
    });
    animations.push({ head, hands, phase: index * 0.9, state: p.state });
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
    box(group, 1.0, 0.9, 0.4, "#b6c6b1", -4.05, 0.5, 2.9);
    for (const h of [0.25, 0.55, 0.82])
      box(group, 0.85, 0.045, 0.44, "#f2e5c9", -4.05, h, 2.9);
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
  });
  const bounds = new THREE.Box3().setFromObject(center);
  const mid = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  center.position.sub(new THREE.Vector3(mid.x, 0, mid.z));
  const radius = Math.max(6, Math.sqrt(size.x ** 2 + size.z ** 2) / 2);
  const direction = new THREE.Vector3(0.8, 1.0, 1.0).normalize();
  function reset() {
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
    if (!reduce.matches)
      animations.forEach((a) => {
        const active = a.state === "working" || a.state === "review";
        a.head.rotation.x = active ? Math.sin(t * 0.002 + a.phase) * 0.035 : 0;
        a.hands.forEach((h, j) => {
          h.position.y =
            1.025 + (active ? Math.sin(t * 0.009 + a.phase + j) * 0.014 : 0);
        });
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
    focus(id: string) {
      const station = stations.get(id);
      if (!station) return;
      scene.updateMatrixWorld(true);
      const target = station.getWorldPosition(new THREE.Vector3());
      target.y = 0.8;
      controls.target.copy(target);
      camera.position.copy(
        target
          .clone()
          .add(
            direction
              .clone()
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
