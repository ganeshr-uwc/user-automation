const fs = require("fs");
const env = require("./config/env");
const { login } = require("./scripts/login");
const { signup } = require("./scripts/signup");
const { automate } = require("./scripts/automate");
const { onboard } = require("./scripts/onboard");
const { runTask } = require("./scripts/runTask");

const command = process.argv[2];

async function main() {
  if (command === "signup") {
    console.log("Running Clerk sign-up flow…");
    await signup();
    return;
  }

  if (command === "automate") {
    console.log("Running automate flow (login → signup fallback)…");
    await automate();
    return;
  }

  if (command === "onboard") {
    console.log("Running onboarding flow…");
    await onboard();
    return;
  }

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
