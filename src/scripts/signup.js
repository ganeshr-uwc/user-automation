const env = require("../config/env");
const { getBrowser, closeBrowser } = require("../utils/browser");

/**
 * Handles Clerk's sign-up flow:
 *   Step 1 — fill first name, last name, email address; click Continue
 *   Step 2 — wait for OTP verification page, fill the code
 *   Step 3 — wait for redirect to the authenticated dashboard, save session
 */
async function signup(
  { url, email, firstName, lastName, otp } = {}
) {
  const targetUrl = url || env.signupUrl;
  const targetEmail = email || env.signupEmail;
  const targetFirstName = firstName || env.signupFirstName;
  const targetLastName = lastName || env.signupLastName;
  const targetOtp = otp || env.otpCode;

  const browser = await getBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(env.navigationTimeout);

  try {
    console.log(`Navigating to ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });

    // --- Step 1: Fill sign-up form ---
    console.log("Step 1: Filling sign-up form…");

    const firstNameInput = page.locator(env.selectorFirstName);
    await firstNameInput.waitFor({
      state: "visible",
      timeout: env.stepTransitionTimeout,
    });
    await firstNameInput.fill(targetFirstName);

    const lastNameInput = page.locator(env.selectorLastName);
    await lastNameInput.waitFor({
      state: "visible",
      timeout: env.stepTransitionTimeout,
    });
    await lastNameInput.fill(targetLastName);

    const emailInput = page.locator(env.selectorEmailAddress);
    await emailInput.waitFor({
      state: "visible",
      timeout: env.stepTransitionTimeout,
    });
    await emailInput.fill(targetEmail);

    console.log(
      `Filled: firstName="${targetFirstName}", lastName="${targetLastName}", email="${targetEmail}"`
    );

    const continueBtn = page.locator(env.selectorContinue).first();
    await continueBtn.click();

    // --- Step 2: OTP verification ---
    console.log("Step 2: Waiting for OTP verification…");
    await page.waitForURL("**/sign-up/verify**", {
      timeout: env.stepTransitionTimeout,
    });

    const otpInput = page.locator(env.selectorOtp).first();
    await otpInput.waitFor({
      state: "visible",
      timeout: env.stepTransitionTimeout,
    });

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

    console.log("Sign-up successful — session saved.");
  } catch (error) {
    throw new Error(`Sign-up failed: ${error.message}`);
  } finally {
    await context.close();
    await closeBrowser();
  }
}

if (require.main === module) {
  signup().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { signup };
