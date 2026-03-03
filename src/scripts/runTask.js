const fs = require("fs");
const path = require("path");
const env = require("../config/env");
const { getBrowser, closeBrowser } = require("../utils/browser");

async function runTask() {
  if (!fs.existsSync(env.authStatePath)) {
    throw new Error(
      `Auth state not found at ${env.authStatePath}. Run login first.`
    );
  }

  const browser = await getBrowser();
  const context = await browser.newContext({
    storageState: env.authStatePath,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(env.navigationTimeout);

  try {
    console.log(`Opening protected page: ${env.protectedUrl}`);
    await page.goto(env.protectedUrl, { waitUntil: "domcontentloaded" });

    // Verify we landed on the authenticated page (not redirected back to sign-in)
    const currentUrl = page.url();
    if (currentUrl.includes("/sign-in")) {
      throw new Error(
        "Session expired — redirected back to sign-in. Delete auth.json and re-run login."
      );
    }

    const screenshotDir = path.dirname(env.screenshotPath);
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    await page.screenshot({ path: env.screenshotPath, fullPage: true });
    console.log(`Screenshot saved to ${env.screenshotPath}`);
    console.log("Task completed successfully.");
  } catch (error) {
    throw new Error(`Task failed: ${error.message}`);
  } finally {
    await context.close();
    await closeBrowser();
  }
}

if (require.main === module) {
  runTask().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { runTask };
