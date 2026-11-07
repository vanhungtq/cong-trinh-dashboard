import { spawnSync } from "node:child_process";
const deployment = spawnSync("npx", ["wrangler", "deploy"], {
  stdio: "inherit",
  env: process.env,
});
if (deployment.status !== 0) process.exit(deployment.status || 1);
const secrets = {};
for (const key of [
  "TRELLO_API_KEY",
  "TRELLO_TOKEN",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
])
  if (process.env[key]) secrets[key] = process.env[key];
// Never persist secrets to source files or print their values.
if (Object.keys(secrets).length) {
  const r = spawnSync("npx", ["wrangler", "secret", "bulk"], {
    input: JSON.stringify(secrets),
    stdio: ["pipe", "inherit", "inherit"],
    env: process.env,
  });
  if (r.status !== 0) process.exit(r.status || 1);
}
process.exit(0);
