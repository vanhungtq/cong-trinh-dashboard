export type AmbientActivity =
  "walking" | "brewing" | "drinking" | "waving" | "resting";
const stops = [
  { duration: 10, from: [3.1, 2.65], to: [-3.15, 2.35], activity: "walking" },
  { duration: 8, from: [-3.15, 2.35], to: [-3.15, 2.35], activity: "brewing" },
  { duration: 3, from: [-3.15, 2.35], to: [-1.4, 2.65], activity: "walking" },
  { duration: 5, from: [-1.4, 2.65], to: [-1.4, 2.65], activity: "drinking" },
  { duration: 10, from: [-1.4, 2.65], to: [3.1, 2.65], activity: "walking" },
  { duration: 4, from: [3.1, 2.65], to: [3.1, 2.65], activity: "waving" },
  { duration: 2, from: [3.1, 2.65], to: [3.1, 2.65], activity: "resting" },
] as const;
export function sampleOfficeActivity(seconds: number, offset = 0, lane = 0) {
  let time = (((seconds + offset) % 42) + 42) % 42;
  for (const s of stops) {
    if (time <= s.duration) {
      const progress = time / s.duration,
        x = s.from[0] + (s.to[0] - s.from[0]) * progress,
        z = s.from[1] + (s.to[1] - s.from[1]) * progress + lane * 0.2;
      const yaw =
        s.activity === "walking"
          ? Math.atan2(-(s.to[0] - s.from[0]), -(s.to[1] - s.from[1]))
          : s.activity === "brewing"
            ? Math.PI
            : s.activity === "drinking"
              ? 2.6
              : Math.PI;
      return { x, z, yaw, progress, activity: s.activity as AmbientActivity };
    }
    time -= s.duration;
  }
  return {
    x: 3.1,
    z: 2.65 + lane * 0.2,
    yaw: Math.PI,
    progress: 0,
    activity: "resting" as AmbientActivity,
  };
}
