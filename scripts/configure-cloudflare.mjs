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
const authMode = process.env.AUTH_MODE || c.vars.AUTH_MODE || "password";
if (!["password", "access"].includes(authMode))
  throw Error("AUTH_MODE must be password or access.");
c.vars.AUTH_MODE = authMode;
if (mode === "live") {
  const keys =
    authMode === "access"
      ? ["CF_ACCESS_TEAM_DOMAIN", "CF_ACCESS_AUD", "ADMIN_EMAIL"]
      : ["ADMIN_EMAIL"];
  for (const key of keys) {
    const value = process.env[key] || c.vars[key];
    if (!value) throw Error("Missing " + key);
    c.vars[key] = value;
  }
}
await writeFile("wrangler.jsonc", JSON.stringify(c, null, 2) + "\n");
console.log("Cloudflare configuration prepared for " + mode + " mode.");
