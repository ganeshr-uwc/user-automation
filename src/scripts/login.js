const env = require("../config/env");
const { getBrowser, closeBrowser } = require("../utils/browser");

/**
 * Handles Clerk's OTP-based sign-in flow:
 *   Step 1 — enter email, click Continue
 *   Step 2 — wait for OTP verification page (/sign-in/factor-one),
 *            fill the code; Clerk auto-submits once all digits are entered
 *   Step 3 — wait for redirect to the authenticated dashboard, save session
 */
async function login({ url, email, otp } = {}) {
  const targetUrl = url || env.targetUrl;
  const targetEmail = email || env.loginEmail;
  const targetOtp = otp || env.otpCode;

  const browser = await getBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(env.navigationTimeout);

  try {
    console.log(`Navigating to ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });

    // --- Step 1: Email ---
    console.log("Step 1: Entering email…");
    const emailInput = page.locator(env.selectorEmail);
    await emailInput.waitFor({
      state: "visible",
      timeout: env.stepTransitionTimeout,
    });
    await emailInput.fill(targetEmail);

    const continueBtn = page.locator(env.selectorContinue).first();
    await continueBtn.click();

    // --- Step 2: OTP verification ---
    console.log("Step 2: Waiting for OTP input…");
    await page.waitForURL("**/sign-in/factor-one**", {
      timeout: env.stepTransitionTimeout,
    });

    const otpInput = page.locator(env.selectorOtp).first();
    await otpInput.waitFor({
      state: "visible",
      timeout: env.stepTransitionTimeout,
    });

    // Type digits one-by-one so Clerk's input handler registers each keystroke
    // and triggers auto-submit after the last digit.
    console.log("Entering OTP code…");
    await otpInput.pressSequentially(targetOtp, { delay: 100 });

    // Clerk auto-submits after all digits are filled.
    // If it doesn't redirect within a short window, click Continue as fallback.
    try {
      await page.waitForURL(env.authSuccessUrl + "**", { timeout: 8_000 });
    } catch {
      console.log("Auto-submit did not trigger — clicking Continue…");
      const submitBtn = page.locator(env.selectorContinue).first();
      await submitBtn.click();
      await page.waitForURL(env.authSuccessUrl + "**", {
        timeout: env.navigationTimeout,
      });
    }

    // --- Step 3: Save session ---
    console.log(`Saving session state to ${env.authStatePath}`);
    await context.storageState({ path: env.authStatePath });

    console.log("Login successful — session saved.");
  } catch (error) {
    throw new Error(`Login failed: ${error.message}`);
  } finally {
    await context.close();
    await closeBrowser();
  }
}

if (require.main === module) {
  login().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { login };
