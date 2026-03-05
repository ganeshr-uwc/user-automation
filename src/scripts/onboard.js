const fs = require("fs");
const env = require("../config/env");
const { getBrowser, closeBrowser } = require("../utils/browser");

/**
 * Handles the AskSam post-auth onboarding wizard:
 *   Step 1 — "Welcome to the asksam app!" popup → click Continue
 *   Step 2 — Agree to terms & conditions → check checkbox, click Continue
 *   Step 3 — Fill first name, middle name, last name → click Continue
 *   Step 4 — Select gender → click Continue
 *   Step 5 — Select date of birth → click Continue
 *   Step 6 — Enter referral code → click Verify
 *   Step 7 — Select "Google" radio option → click Complete Profile
 *   Step 8 — Wait for post-onboarding popup → click Skip
 */
async function onboard() {
  if (!fs.existsSync(env.authStatePath)) {
    throw new Error(
      `Auth state not found at ${env.authStatePath}. Run login or signup first.`
    );
  }

  const browser = await getBrowser();
  const context = await browser.newContext({
    storageState: env.authStatePath,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(env.navigationTimeout);

  try {
    console.log(`Opening app: ${env.protectedUrl}`);
    await page.goto(env.protectedUrl, { waitUntil: "domcontentloaded" });

    // --- Step 1: Welcome popup (conditional) ---
    console.log("Checking for onboarding welcome popup…");
    const welcomeHeading = page.getByText("Welcome to the asksam app!");
    try {
      await welcomeHeading.waitFor({
        state: "visible",
        timeout: env.onboardDetectTimeout,
      });
    } catch {
      console.log("Onboarding already completed — skipping.");
      return;
    }
    console.log("Welcome popup detected.");

    const welcomeContinueBtn = page
      .getByRole("button", { name: "Continue" })
      .first();
    await welcomeContinueBtn.click();
    console.log("Clicked Continue on welcome popup.");

    // --- Step 2: Terms & conditions ---
    console.log("Step 2: Accepting terms & conditions…");
    await page.waitForTimeout(1000);

    const checkbox = page.locator('input[type="checkbox"]').first();
    await checkbox.waitFor({
      state: "visible",
      timeout: env.stepTransitionTimeout,
    });
    await checkbox.check({ force: true });
    console.log("Terms & conditions checkbox checked.");

    const termsContinueBtn = page
      .getByRole("button", { name: "Continue" })
      .first();
    await termsContinueBtn.waitFor({
      state: "visible",
      timeout: env.stepTransitionTimeout,
    });
    await termsContinueBtn.click();
    console.log("Clicked Continue on terms & conditions.");

    // --- Step 3: Name form ---
    console.log("Step 3: Filling name form…");
    await page.waitForTimeout(1000);

    const firstNameInput = page.getByLabel("First Name").or(
      page.locator(
        'input[name="firstName"], input[placeholder*="First"], input[placeholder*="first"]'
      )
    );
    await firstNameInput.first().waitFor({
      state: "visible",
      timeout: env.stepTransitionTimeout,
    });
    await firstNameInput.first().fill(env.onboardFirstName);

    if (env.onboardMiddleName) {
      const middleNameInput = page.getByLabel("Middle Name").or(
        page.locator(
          'input[name="middleName"], input[placeholder*="Middle"], input[placeholder*="middle"]'
        )
      );
      await middleNameInput.first().fill(env.onboardMiddleName);
    }

    const lastNameInput = page.getByLabel("Last Name").or(
      page.locator(
        'input[name="lastName"], input[placeholder*="Last"], input[placeholder*="last"]'
      )
    );
    await lastNameInput.first().waitFor({
      state: "visible",
      timeout: env.stepTransitionTimeout,
    });
    await lastNameInput.first().fill(env.onboardLastName);

    console.log(
      `Filled: firstName="${env.onboardFirstName}", middleName="${env.onboardMiddleName}", lastName="${env.onboardLastName}"`
    );

    const nameContinueBtn = page
      .getByRole("button", { name: "Continue" })
      .first();
    await nameContinueBtn.click();
    console.log("Clicked Continue on name form.");

    // --- Step 4: Gender selection ---
    console.log("Step 4: Selecting gender…");
    await page.waitForTimeout(1000);

    const genderOption = page.getByText(env.onboardGender, { exact: true }).or(
      page.getByLabel(env.onboardGender)
    );
    await genderOption.first().waitFor({
      state: "visible",
      timeout: env.stepTransitionTimeout,
    });
    await genderOption.first().click();
    console.log(`Selected gender: "${env.onboardGender}"`);

    const genderContinueBtn = page
      .getByRole("button", { name: "Continue" })
      .first();
    await genderContinueBtn.click();
    console.log("Clicked Continue on gender selection.");

    // --- Step 5: Date of birth ---
    console.log("Step 5: Selecting date of birth…");
    await page.waitForTimeout(1000);

    const [dobYear, dobMonthStr, dobDayStr] = env.onboardDob.split("-");
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const monthName = monthNames[parseInt(dobMonthStr, 10) - 1];
    const dayStr = parseInt(dobDayStr, 10).toString();

    const comboboxes = page.locator('button[role="combobox"]');
    await comboboxes.first().waitFor({
      state: "visible",
      timeout: env.stepTransitionTimeout,
    });

    // Day
    await comboboxes.first().click();
    await page.waitForTimeout(300);
    await page.getByRole("option", { name: dayStr, exact: true }).click();
    await page.waitForTimeout(300);
    console.log(`Selected day: ${dayStr}`);

    // Month
    await comboboxes.nth(1).click();
    await page.waitForTimeout(300);
    await page.getByRole("option", { name: monthName, exact: true }).click();
    await page.waitForTimeout(300);
    console.log(`Selected month: ${monthName}`);

    // Year
    await comboboxes.nth(2).click();
    await page.waitForTimeout(300);
    const yearOption = page.getByRole("option", { name: dobYear, exact: true });
    await yearOption.scrollIntoViewIfNeeded();
    await yearOption.click();
    await page.waitForTimeout(300);
    console.log(`Selected year: ${dobYear}`);

    const dobContinueBtn = page
      .getByRole("button", { name: "Continue" })
      .first();
    await dobContinueBtn.click();
    console.log("Clicked Continue on DOB selection.");

    // --- Step 6: Referral code ---
    console.log("Step 6: Entering referral code…");
    await page.waitForTimeout(1000);

    const referralInput = page.getByPlaceholder(/referral|code/i).or(
      page.locator(
        'input[name*="referral"], input[name*="code"], input[placeholder*="Referral"], input[placeholder*="code"]'
      )
    );
    await referralInput.first().waitFor({
      state: "visible",
      timeout: env.stepTransitionTimeout,
    });
    await referralInput.first().fill(env.onboardReferralCode);
    console.log(`Entered referral code: "${env.onboardReferralCode}"`);

    const verifyBtn = page
      .getByRole("button", { name: /Verify/i })
      .first();
    await verifyBtn.click();
    console.log("Clicked Verify button.");

    // Wait for verification to complete
    await page.waitForTimeout(3000);

    // --- Step 7: "How did you hear about us?" radio selection ---
    console.log("Step 7: Selecting 'Google' radio option…");
    const googleRadio = page
      .getByRole("radio", { name: /google/i })
      .or(page.getByLabel(/google/i))
      .or(page.getByText("Google", { exact: false }));
    await googleRadio.first().waitFor({
      state: "visible",
      timeout: env.stepTransitionTimeout,
    });
    await googleRadio.first().click();
    console.log('Selected "Google" radio option.');

    const completeBtn = page
      .getByRole("button", { name: /Complete Profile/i })
      .first();
    await completeBtn.waitFor({
      state: "visible",
      timeout: env.stepTransitionTimeout,
    });
    await completeBtn.click();
    console.log("Clicked Complete Profile.");

    // --- Step 8: Skip post-onboarding popup ---
    console.log("Step 8: Waiting for post-onboarding popup…");
    const skipBtn = page.getByRole("button", { name: /Skip/i }).first();
    await skipBtn.waitFor({
      state: "visible",
      timeout: env.navigationTimeout,
    });
    console.log("Post-onboarding popup detected.");
    await skipBtn.click();
    console.log("Clicked Skip on post-onboarding popup.");

    await skipBtn.waitFor({
      state: "hidden",
      timeout: env.stepTransitionTimeout,
    });
    console.log("Post-onboarding popup closed.");
    await page.waitForTimeout(2000);

    await context.storageState({ path: env.authStatePath });

    console.log("Onboarding completed successfully — session saved.");
  } catch (error) {
    throw new Error(`Onboarding failed: ${error.message}`);
  } finally {
    await context.close();
    await closeBrowser();
  }
}

if (require.main === module) {
  onboard().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { onboard };
