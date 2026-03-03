const fs = require("fs");
const env = require("./config/env");
const { login } = require("./scripts/login");
const { runTask } = require("./scripts/runTask");

async function main() {
  const hasAuth = fs.existsSync(env.authStatePath);

  if (!hasAuth) {
    console.log("No saved session found — running Clerk login flow…");
    await login();
  } else {
    console.log("Existing session found — skipping login.");
  }

  await runTask();
}

main().catch((error) => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
