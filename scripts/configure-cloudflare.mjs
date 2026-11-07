import { readFile, writeFile } from "node:fs/promises";
const c = JSON.parse(await readFile("wrangler.jsonc", "utf8"));
const id = process.env.D1_DATABASE_ID;
if (
  !id ||
  !/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(id) ||
  id.startsWith("00000000")
)
  throw Error("Set D1_DATABASE_ID to the ID returned by wrangler d1 create.");
c.d1_databases[0].database_id = id;
const mode = process.env.APP_MODE || "demo";
if (!["demo", "live"].includes(mode))
  throw Error("APP_MODE must be demo or live.");
c.vars.APP_MODE = mode;
if (mode === "live")
  for (const key of ["CF_ACCESS_TEAM_DOMAIN", "CF_ACCESS_AUD", "ADMIN_EMAIL"]) {
    if (!process.env[key]) throw Error("Missing " + key);
    c.vars[key] = process.env[key];
  }
await writeFile("wrangler.jsonc", JSON.stringify(c, null, 2) + "\n");
console.log("Cloudflare configuration prepared for " + mode + " mode.");
