const env = require("../config/env");
const { getBrowser, closeBrowser } = require("../utils/browser");
const { onboard } = require("./onboard");
const { chat } = require("./chat");
const { bookAppointment } = require("./book-appointment");

function generateSignupEmail() {
  const timestamp = Date.now();
  return `${env.automateEmailPrefix}${timestamp}+${env.automateEmailTag}@${env.automateEmailDomain}`;
}

/**
 * Attempts Clerk login with LOGIN_EMAIL.
 * If Clerk reports "user not found", auto-generates a unique email and
 * runs the sign-up flow instead. Saves the session to auth.json either way.
 */
async function automate() {
  const browser = await getBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(env.navigationTimeout);

  try {
    // ── Step 1: Attempt login ──────────────────────────────────────────
    console.log(`Navigating to ${env.targetUrl}`);
    await page.goto(env.targetUrl, { waitUntil: "domcontentloaded" });

    console.log(`Entering login email: ${env.loginEmail}`);
    const emailInput = page.locator(env.selectorEmail);
    await emailInput.waitFor({
      state: "visible",
      timeout: env.stepTransitionTimeout,
    });
    await emailInput.fill(env.loginEmail);

    const continueBtn = page.locator(env.selectorContinue).first();
    await continueBtn.click();

    // ── Step 2: Detect outcome — OTP page or "user not found" ──────────
    console.log("Detecting login outcome…");

    const outcome = await Promise.race([
      page
        .waitForURL("**/sign-in/factor-one**", {
          timeout: env.stepTransitionTimeout,
        })
        .then(() => "otp"),
      page
        .getByTestId("form-feedback-error")
        .waitFor({ state: "visible", timeout: env.stepTransitionTimeout })
        .then(() => "not-found"),
    ]);

    if (outcome === "otp") {
      await completeOtpLogin(page, context);
    } else {
      console.log("User not found — switching to sign-up flow…");
      await performSignup(page, context);
    }

    console.log(`Session saved to ${env.authStatePath}`);
  } catch (error) {
    throw new Error(`Automate flow failed: ${error.message}`);
  } finally {
    await context.close();
    await closeBrowser();
  }
}

async function completeOtpLogin(page, context) {
  console.log("User found — completing OTP login…");

  const otpInput = page.locator(env.selectorOtp).first();
  await otpInput.waitFor({
    state: "visible",
    timeout: env.stepTransitionTimeout,
  });

  console.log("Entering OTP code…");
  await otpInput.pressSequentially(env.otpCode, { delay: 100 });

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

  await context.storageState({ path: env.authStatePath });
  console.log("Login successful.");
}

async function performSignup(page, context) {
  const generatedEmail = generateSignupEmail();
  console.log(`Generated signup email: ${generatedEmail}`);

  console.log(`Navigating to ${env.signupUrl}`);
  await page.goto(env.signupUrl, { waitUntil: "domcontentloaded" });

  // ── Fill sign-up form ────────────────────────────────────────────────
  const firstNameInput = page.locator(env.selectorFirstName);
  await firstNameInput.waitFor({
    state: "visible",
    timeout: env.stepTransitionTimeout,
  });
  await firstNameInput.fill(env.signupFirstName);

  const lastNameInput = page.locator(env.selectorLastName);
  await lastNameInput.waitFor({
    state: "visible",
    timeout: env.stepTransitionTimeout,
  });
  await lastNameInput.fill(env.signupLastName);

  const emailInput = page.locator(env.selectorEmailAddress);
  await emailInput.waitFor({
    state: "visible",
    timeout: env.stepTransitionTimeout,
  });
  await emailInput.fill(generatedEmail);

  console.log(
    `Filled: firstName="${env.signupFirstName}", lastName="${env.signupLastName}", email="${generatedEmail}"`
  );

  const continueBtn = page.locator(env.selectorContinue).first();
  await continueBtn.click();

  // ── OTP verification ─────────────────────────────────────────────────
  console.log("Waiting for OTP verification…");
  await page.waitForURL("**/sign-up/verify**", {
    timeout: env.stepTransitionTimeout,
  });

  const otpInput = page.locator(env.selectorOtp).first();
  await otpInput.waitFor({
    state: "visible",
    timeout: env.stepTransitionTimeout,
  });

  console.log("Entering OTP code…");
  await otpInput.pressSequentially(env.otpCode, { delay: 100 });

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

  await context.storageState({ path: env.authStatePath });
  console.log("Sign-up successful.");
}

if (require.main === module) {
  automate()
    .then(() => onboard())
    .then(() => chat())
    .then(() => bookAppointment())
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}

module.exports = { automate };
