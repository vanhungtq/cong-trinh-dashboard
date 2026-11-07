import { build } from "esbuild";
import {
  readFile,
  readdir,
  mkdir,
  writeFile,
  copyFile,
} from "node:fs/promises";
import path from "node:path";
const assets = {};
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
};
async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p);
    else
      assets["/" + path.relative("dist/client", p)] = {
        body: (await readFile(p)).toString("base64"),
        type: types[path.extname(p)] || "application/octet-stream",
      };
  }
}
await walk("dist/client");
await mkdir("dist/server", { recursive: true });
await build({
  entryPoints: ["worker/index.ts"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  outfile: "dist/server/index.js",
  define: { __ASSETS__: JSON.stringify(assets) },
  minify: true,
});
try {
  await mkdir("dist/.openai", { recursive: true });
  await copyFile(".openai/hosting.json", "dist/.openai/hosting.json");
} catch {}
console.log("Built portable Cloudflare Worker with embedded frontend assets.");
