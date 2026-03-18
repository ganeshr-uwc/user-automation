const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const env = require("../config/env");

const REPORTS_DIR = path.resolve(__dirname, "../../reports");
const SCREENSHOTS_DIR = path.join(REPORTS_DIR, "screenshots");
const VIDEOS_DIR = path.join(REPORTS_DIR, "videos");

// ── Helpers ──────────────────────────────────────────────────────────────────

function ensureDirs() {
  for (const dir of [REPORTS_DIR, SCREENSHOTS_DIR, VIDEOS_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return `screenshots/${name}.png`;
}

function elapsed(start) {
  return ((Date.now() - start) / 1000).toFixed(1) + "s";
}

// ── Test definitions ─────────────────────────────────────────────────────────

// Tests that depend on the chat backend are skipped in CI because
// the AskSam server rejects WebSocket sessions from GitHub Actions IPs.
const CI = process.env.CI === "true";

const tests = [
  {
    id: "login",
    name: CI ? "Signup (New Account)" : "Login (OTP)",
    run: CI ? runSignup : runLogin,
  },
  {
    id: "onboard",
    name: "Onboarding Wizard",
    run: runOnboard,
  },
  {
    id: "chat",
    name: "Chat Reply Verification",
    run: runChat,
  },
  {
    id: "book-appointment",
    name: "Book Appointment",
    run: runBookAppointment,
  },
];

// ── Test implementations ─────────────────────────────────────────────────────

async function runLogin(page, screenshots) {
  await page.goto(env.targetUrl, { waitUntil: "domcontentloaded" });

  const emailInput = page.locator(env.selectorEmail);
  await emailInput.waitFor({
    state: "visible",
    timeout: env.stepTransitionTimeout,
  });
  await emailInput.fill(env.loginEmail);
  screenshots.push(await screenshot(page, "login-01-email"));

  const continueBtn = page.locator(env.selectorContinue).first();
  await continueBtn.click();

  await page.waitForURL("**/sign-in/factor-one**", {
    timeout: env.stepTransitionTimeout,
  });

  const otpInput = page.locator(env.selectorOtp).first();
  await otpInput.waitFor({
    state: "visible",
    timeout: env.stepTransitionTimeout,
  });
  await otpInput.pressSequentially(env.otpCode, { delay: 100 });
  screenshots.push(await screenshot(page, "login-02-otp"));

  try {
    await page.waitForURL(env.authSuccessUrl + "**", { timeout: 8_000 });
  } catch {
    const submitBtn = page.locator(env.selectorContinue).first();
    await submitBtn.click();
    await page.waitForURL(env.authSuccessUrl + "**", {
      timeout: env.navigationTimeout,
    });
  }

  await page.context().storageState({ path: env.authStatePath });
  screenshots.push(await screenshot(page, "login-03-success"));
}

async function runSignup(page, screenshots) {
  const generatedEmail = `${env.automateEmailPrefix}${Date.now()}+${env.automateEmailTag}@${env.automateEmailDomain}`;
  console.log(`  Generated signup email: ${generatedEmail}`);

  await page.goto(env.signupUrl, { waitUntil: "domcontentloaded" });

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
  screenshots.push(await screenshot(page, "login-01-email"));

  const continueBtn = page.locator(env.selectorContinue).first();
  await continueBtn.click();

  await page.waitForURL("**/sign-up/verify**", {
    timeout: env.stepTransitionTimeout,
  });

  const otpInput = page.locator(env.selectorOtp).first();
  await otpInput.waitFor({
    state: "visible",
    timeout: env.stepTransitionTimeout,
  });
  await otpInput.pressSequentially(env.otpCode, { delay: 100 });
  screenshots.push(await screenshot(page, "login-02-otp"));

  try {
    await page.waitForURL(env.authSuccessUrl + "**", { timeout: 8_000 });
  } catch {
    const submitBtn = page.locator(env.selectorContinue).first();
    await submitBtn.click();
    await page.waitForURL(env.authSuccessUrl + "**", {
      timeout: env.navigationTimeout,
    });
  }

  await page.context().storageState({ path: env.authStatePath });
  screenshots.push(await screenshot(page, "login-03-success"));
}

async function runOnboard(page, screenshots) {
  await page.goto(env.protectedUrl, { waitUntil: "domcontentloaded" });

  const welcomeHeading = page.getByText("Welcome to the asksam app!");
  try {
    await welcomeHeading.waitFor({
      state: "visible",
      timeout: env.onboardDetectTimeout,
    });
  } catch {
    screenshots.push(await screenshot(page, "onboard-00-skipped"));
    console.log("  Onboarding already completed — skipped.");
    return;
  }
  screenshots.push(await screenshot(page, "onboard-01-welcome"));

  // Step 1: Welcome → Continue
  const welcomeContinueBtn = page
    .getByRole("button", { name: "Continue" })
    .first();
  await welcomeContinueBtn.click();
  await page.waitForTimeout(1000);

  // Step 2: Terms
  const checkbox = page.locator('input[type="checkbox"]').first();
  await checkbox.waitFor({
    state: "visible",
    timeout: env.stepTransitionTimeout,
  });
  await checkbox.check({ force: true });
  screenshots.push(await screenshot(page, "onboard-02-terms"));
  const termsContinueBtn = page
    .getByRole("button", { name: "Continue" })
    .first();
  await termsContinueBtn.click();
  await page.waitForTimeout(1000);

  // Step 3: Name
  const firstNameInput = page
    .getByLabel("First Name")
    .or(
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
    const middleNameInput = page
      .getByLabel("Middle Name")
      .or(
        page.locator(
          'input[name="middleName"], input[placeholder*="Middle"], input[placeholder*="middle"]'
        )
      );
    await middleNameInput.first().fill(env.onboardMiddleName);
  }
  const lastNameInput = page
    .getByLabel("Last Name")
    .or(
      page.locator(
        'input[name="lastName"], input[placeholder*="Last"], input[placeholder*="last"]'
      )
    );
  await lastNameInput.first().fill(env.onboardLastName);
  screenshots.push(await screenshot(page, "onboard-03-name"));
  const nameContinueBtn = page
    .getByRole("button", { name: "Continue" })
    .first();
  await nameContinueBtn.click();
  await page.waitForTimeout(1000);

  // Step 4: Gender
  const genderOption = page
    .getByText(env.onboardGender, { exact: true })
    .or(page.getByLabel(env.onboardGender));
  await genderOption.first().waitFor({
    state: "visible",
    timeout: env.stepTransitionTimeout,
  });
  await genderOption.first().click();
  screenshots.push(await screenshot(page, "onboard-04-gender"));
  const genderContinueBtn = page
    .getByRole("button", { name: "Continue" })
    .first();
  await genderContinueBtn.click();
  await page.waitForTimeout(1000);

  // Step 5: DOB
  const [dobYear, dobMonthStr, dobDayStr] = env.onboardDob.split("-");
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const monthName = monthNames[parseInt(dobMonthStr, 10) - 1];
  const dayStr = parseInt(dobDayStr, 10).toString();
  const comboboxes = page.locator('button[role="combobox"]');
  await comboboxes.first().waitFor({
    state: "visible",
    timeout: env.stepTransitionTimeout,
  });
  await comboboxes.first().click();
  await page.waitForTimeout(300);
  await page.getByRole("option", { name: dayStr, exact: true }).click();
  await page.waitForTimeout(300);
  await comboboxes.nth(1).click();
  await page.waitForTimeout(300);
  await page.getByRole("option", { name: monthName, exact: true }).click();
  await page.waitForTimeout(300);
  await comboboxes.nth(2).click();
  await page.waitForTimeout(300);
  const yearOption = page.getByRole("option", {
    name: dobYear,
    exact: true,
  });
  await yearOption.scrollIntoViewIfNeeded();
  await yearOption.click();
  screenshots.push(await screenshot(page, "onboard-05-dob"));
  const dobContinueBtn = page
    .getByRole("button", { name: "Continue" })
    .first();
  await dobContinueBtn.click();
  await page.waitForTimeout(1000);

  // Step 6: Referral
  const referralInput = page
    .getByPlaceholder(/referral|code/i)
    .or(
      page.locator(
        'input[name*="referral"], input[name*="code"], input[placeholder*="Referral"], input[placeholder*="code"]'
      )
    );
  await referralInput.first().waitFor({
    state: "visible",
    timeout: env.stepTransitionTimeout,
  });
  await referralInput.first().fill(env.onboardReferralCode);
  const verifyBtn = page.getByRole("button", { name: /Verify/i }).first();
  await verifyBtn.click();
  await page.waitForTimeout(3000);
  screenshots.push(await screenshot(page, "onboard-06-referral"));

  // Step 7: How did you hear
  const googleRadio = page
    .getByRole("radio", { name: /google/i })
    .or(page.getByLabel(/google/i))
    .or(page.getByText("Google", { exact: false }));
  await googleRadio.first().waitFor({
    state: "visible",
    timeout: env.stepTransitionTimeout,
  });
  await googleRadio.first().click();
  screenshots.push(await screenshot(page, "onboard-07-source"));
  const completeBtn = page
    .getByRole("button", { name: /Complete Profile/i })
    .first();
  await completeBtn.click();

  // Step 8: Skip popup
  const skipBtn = page.getByRole("button", { name: /Skip/i }).first();
  await skipBtn.waitFor({
    state: "visible",
    timeout: env.navigationTimeout,
  });
  await skipBtn.click();
  await skipBtn.waitFor({
    state: "hidden",
    timeout: env.stepTransitionTimeout,
  });
  await page.waitForTimeout(2000);
  await page.context().storageState({ path: env.authStatePath });
  screenshots.push(await screenshot(page, "onboard-08-complete"));
}

async function runChat(page, screenshots) {
  const CHAT_CONTAINER_SEL = 'main div[class*="overflow-y-scroll"]';
  const BOT_MESSAGE_SEL = `${CHAT_CONTAINER_SEL} > div[class*="justify-start"]`;

  // Try loading chat page — reload if "Retry Connection" appears
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto(env.chatUrl, { waitUntil: "load" });
    await page.waitForTimeout(5000);

    const retryBtn = page.getByRole("button", { name: /retry connection/i });
    try {
      await retryBtn.waitFor({ state: "visible", timeout: 5000 });
      console.log(`  Session error detected (attempt ${attempt}/3) — reloading page…`);
      await page.waitForTimeout(3000);
    } catch {
      break; // no retry button — connection is fine
    }
  }

  const chatInput = page.getByPlaceholder("Ask Sam");
  await chatInput.waitFor({
    state: "visible",
    timeout: 60_000,
  });
  screenshots.push(await screenshot(page, "chat-01-ready"));

  // Wait for greeting
  try {
    await page.waitForFunction(
      (sel) => document.querySelectorAll(sel).length >= 1,
      BOT_MESSAGE_SEL,
      { timeout: 8000, polling: 500 }
    );
    await waitForStreamingDone(page, BOT_MESSAGE_SEL);
  } catch {
    // no greeting — prompt cards
  }

  const testMessages = [
    "I've been feeling really anxious lately, what can I do?",
    "How can I improve my sleep quality?",
  ];

  let passed = 0;
  for (let i = 0; i < testMessages.length; i++) {
    const msg = testMessages[i];
    const beforeCount = await page.evaluate(
      (sel) => document.querySelectorAll(sel).length,
      BOT_MESSAGE_SEL
    );

    await chatInput.fill(msg);
    await page.keyboard.press("Enter");

    await page.waitForFunction(
      ({ prev, sel }) => document.querySelectorAll(sel).length > prev,
      { prev: beforeCount, sel: BOT_MESSAGE_SEL },
      { timeout: env.chatReplyTimeout, polling: 1000 }
    );
    await waitForStreamingDone(page, BOT_MESSAGE_SEL);
    passed++;
    screenshots.push(await screenshot(page, `chat-02-reply-${i + 1}`));
  }

  if (passed < testMessages.length) {
    throw new Error(
      `Chat: only ${passed}/${testMessages.length} replies received.`
    );
  }
}

async function waitForStreamingDone(page, botSel) {
  let prevText = "";
  let stableCount = 0;
  while (stableCount < 3) {
    await page.waitForTimeout(1000);
    const currentText = await page.evaluate((sel) => {
      const msgs = document.querySelectorAll(sel);
      if (msgs.length === 0) return "";
      return msgs[msgs.length - 1].textContent || "";
    }, botSel);
    if (currentText === prevText && currentText.length > 0) {
      stableCount++;
    } else {
      stableCount = 0;
    }
    prevText = currentText;
  }
}

async function runBookAppointment(page, screenshots) {
  await page.goto(env.protectedUrl, { waitUntil: "load" });
  await page.waitForTimeout(3000);

  screenshots.push(await screenshot(page, "book-01-home"));

  // Open sidebar
  const sidebarToggle = page
    .locator('button[aria-label*="menu" i]')
    .or(page.locator('button[aria-label*="sidebar" i]'))
    .or(page.locator("nav button").first())
    .or(page.locator('button:has(svg[class*="menu" i])'))
    .first();
  await sidebarToggle.waitFor({
    state: "visible",
    timeout: env.stepTransitionTimeout,
  });
  await sidebarToggle.click();
  await page.waitForTimeout(1000);
  screenshots.push(await screenshot(page, "book-02-sidebar"));

  // My Appointments
  const myAppointments = page
    .getByText("My Appointments", { exact: false })
    .first();
  await myAppointments.waitFor({
    state: "visible",
    timeout: env.stepTransitionTimeout,
  });
  await myAppointments.evaluate((el) => {
    el.scrollIntoView({ block: "center", behavior: "instant" });
    el.click();
  });
  // Wait for My Appointments page to load
  await page.waitForTimeout(5000);
  screenshots.push(await screenshot(page, "book-03-appointments"));

  // Book Appointment — try button, link, or use JS click
  const bookBtn = page
    .getByRole("button", { name: /book appointment/i })
    .or(page.getByRole("link", { name: /book appointment/i }))
    .or(page.locator('a[href*="booking"]'))
    .or(page.getByText("Book Appointment", { exact: false }))
    .first();
  await bookBtn.waitFor({
    state: "visible",
    timeout: env.navigationTimeout,
  });

  const [bookingPage] = await Promise.all([
    page.context().waitForEvent("page"),
    bookBtn.click(),
  ]);
  await bookingPage.waitForLoadState("domcontentloaded");
  screenshots.push(await screenshot(bookingPage, "book-04-booking-page"));

  // Search
  const searchInput = bookingPage.getByPlaceholder(
    /search professionals by name/i
  );
  await searchInput.waitFor({
    state: "visible",
    timeout: env.stepTransitionTimeout,
  });
  await searchInput.fill("Antony Smith");
  await bookingPage.keyboard.press("Enter");
  await bookingPage.waitForTimeout(3000);
  screenshots.push(await screenshot(bookingPage, "book-05-search-results"));
}

// ── Screenshot label mapping ─────────────────────────────────────────────────

const SCREENSHOT_LABELS = {
  "login-01-email": CI ? "Signup form filled" : "Enter email address",
  "login-02-otp": "OTP verification code entered",
  "login-03-success": "Login successful — dashboard loaded",
  "onboard-00-skipped": "Onboarding already completed",
  "onboard-01-welcome": "Welcome popup detected",
  "onboard-02-terms": "Terms & conditions accepted",
  "onboard-03-name": "Name form filled",
  "onboard-04-gender": "Gender selected",
  "onboard-05-dob": "Date of birth selected",
  "onboard-06-referral": "Referral code verified",
  "onboard-07-source": 'Selected "Google" as referral source',
  "onboard-08-complete": "Onboarding completed",
  "chat-01-ready": "Chat page ready",
  "chat-02-reply-1": "Bot reply received (Message 1)",
  "chat-02-reply-2": "Bot reply received (Message 2)",
  "book-01-home": "Application home page",
  "book-02-sidebar": "Sidebar menu opened",
  "book-03-appointments": "My Appointments page",
  "book-04-booking-page": "Booking portal loaded",
  "book-05-search-results": "Search results displayed",
  "login-FAIL": "FAILURE — page state at error",
  "onboard-FAIL": "FAILURE — page state at error",
  "chat-FAIL": "FAILURE — page state at error",
  "book-appointment-FAIL": "FAILURE — page state at error",
};

const TEST_DESCRIPTIONS = {
  login:
    "Authenticates via Clerk OTP flow: enters email, submits OTP code, and saves the session for subsequent tests.",
  onboard:
    "Completes the 8-step onboarding wizard: welcome popup, terms & conditions, profile details, gender, DOB, referral code, and source selection.",
  chat: "Sends mental health questions to the AskSam chatbot and verifies that bot replies are received and fully streamed.",
  "book-appointment":
    "Navigates the sidebar menu to My Appointments, opens the booking portal, and searches for a professional by name.",
};

const TEST_ICONS = {
  login: `<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>`,
  onboard: `<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>`,
  chat: `<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>`,
  "book-appointment": `<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`,
};

// ── HTML dashboard generator ─────────────────────────────────────────────────

function generateDashboard(results) {
  const now = new Date();
  const timestamp = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const totalPassed = results.filter((r) => r.status === "passed").length;
  const totalFailed = results.filter((r) => r.status === "failed").length;
  const totalSkipped = results.filter((r) => r.status === "skipped").length;
  const totalDuration = results.reduce(
    (sum, r) => sum + parseFloat(r.duration),
    0
  );
  const passRate =
    results.length > 0
      ? Math.round((totalPassed / results.length) * 100)
      : 0;

  // Donut chart
  const donutSize = 110;
  const strokeWidth = 10;
  const radius = (donutSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let arcOffset = 0;
  const arcData = [
    { count: totalPassed, color: "#22c55e" },
    { count: totalFailed, color: "#ef4444" },
    { count: totalSkipped, color: "#f59e0b" },
  ];
  const arcs = arcData
    .filter((a) => a.count > 0)
    .map((a) => {
      const len = (a.count / results.length) * circumference;
      const svg = `<circle cx="${donutSize / 2}" cy="${donutSize / 2}" r="${radius}" fill="none" stroke="${a.color}" stroke-width="${strokeWidth}" stroke-dasharray="${len} ${circumference - len}" stroke-dashoffset="-${arcOffset}" stroke-linecap="round" transform="rotate(-90 ${donutSize / 2} ${donutSize / 2})"/>`;
      arcOffset += len;
      return svg;
    })
    .join("\n      ");

  // Sidebar nav
  const navItems = results
    .map(
      (r, i) => `
      <a class="nav-item${i === 0 ? " active" : ""}" onclick="showTest('test-${r.id}',this)">
        <span class="nav-icon">${TEST_ICONS[r.id] || ""}</span>
        <span class="nav-label">${r.name}</span>
        <span class="nav-badge nav-badge--${r.status}">${r.status === "passed" ? "PASS" : r.status === "failed" ? "FAIL" : "SKIP"}</span>
      </a>`
    )
    .join("");

  // Test panels
  const testPanels = results
    .map((r, idx) => {
      const screenshotCards = r.screenshots
        .map((s, si) => {
          const baseName = path.basename(s, ".png");
          const label = SCREENSHOT_LABELS[baseName] || baseName;
          return `
            <div class="ss-card" onclick="openLightbox('${s}','${label.replace(/'/g, "\\'")}')">
              <div class="ss-img-wrap">
                <img src="${s}" alt="${label}" loading="lazy"/>
                <div class="ss-overlay"><svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#fff" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/></svg></div>
              </div>
              <div class="ss-info">
                <span class="ss-step">Step ${si + 1}</span>
                <span class="ss-label">${label}</span>
              </div>
            </div>`;
        })
        .join("");

      const videoHtml = r.video
        ? `<div class="video-wrap"><video controls preload="metadata"><source src="${r.video}" type="video/webm"></video></div>`
        : '<div class="empty-state">No video recorded for this test.</div>';

      const errorHtml = r.error
        ? `<div class="error-block">
            <div class="error-title"><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Error Details</div>
            <pre class="error-body">${r.error}</pre>
          </div>`
        : "";

      const statusColor =
        r.status === "passed"
          ? "var(--green)"
          : r.status === "failed"
            ? "var(--red)"
            : "var(--amber)";

      return `
      <div class="test-panel${idx === 0 ? " active" : ""}" id="test-${r.id}">
        <div class="panel-header">
          <div class="panel-header-left">
            <div class="panel-icon" style="color:${statusColor}">${TEST_ICONS[r.id] || ""}</div>
            <div class="panel-info">
              <h2>${r.name}</h2>
              <p>${TEST_DESCRIPTIONS[r.id] || ""}</p>
            </div>
          </div>
          <div class="panel-stats">
            <div class="panel-stat"><span class="panel-stat-label">Status</span><span class="pill pill--${r.status}">${r.status.toUpperCase()}</span></div>
            <div class="panel-stat"><span class="panel-stat-label">Duration</span><span class="panel-stat-value">${r.duration}</span></div>
            <div class="panel-stat"><span class="panel-stat-label">Captures</span><span class="panel-stat-value">${r.screenshots.length}</span></div>
          </div>
        </div>
        ${errorHtml}
        <div class="section">
          <div class="section-hd" onclick="toggleSection(this)">
            <h3><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>Screenshots<span class="badge">${r.screenshots.length}</span></h3>
            <svg class="chev" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
          </div>
          <div class="section-bd open">
            <div class="ss-grid">${screenshotCards || '<div class="empty-state">No screenshots captured.</div>'}</div>
          </div>
        </div>
        <div class="section">
          <div class="section-hd" onclick="toggleSection(this)">
            <h3><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>Video Recording</h3>
            <svg class="chev" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
          </div>
          <div class="section-bd open">${videoHtml}</div>
        </div>
      </div>`;
    })
    .join("");

  // Timeline
  const timelineSteps = results
    .map(
      (r) =>
        `<div class="tl-step tl--${r.status}"><div class="tl-dot"></div><span class="tl-name">${r.name}</span><span class="tl-dur">${r.duration}</span></div>`
    )
    .join('<div class="tl-line"></div>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>AskSam | Automation Test Report</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
/* ── Theme variables ────────────────────── */
:root {
  --sidebar-w: 272px;
  --header-h: 60px;
  --bg: #f4f6f9;
  --card: #ffffff;
  --card-hover: #fafbfc;
  --border: #e5e7eb;
  --border-subtle: #f0f0f3;
  --text: #111827;
  --text-2: #4b5563;
  --text-3: #9ca3af;
  --accent: #4f46e5;
  --accent-soft: #eef2ff;
  --green: #16a34a;
  --green-soft: #f0fdf4;
  --red: #dc2626;
  --red-soft: #fef2f2;
  --amber: #d97706;
  --amber-soft: #fffbeb;
  --radius: 14px;
  --radius-sm: 8px;
  --shadow: 0 1px 2px rgba(0,0,0,.04);
  --shadow-md: 0 4px 12px rgba(0,0,0,.06);
  --shadow-lg: 0 12px 24px rgba(0,0,0,.08);
  --font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --mono: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  --donut-track: #e5e7eb;
  --donut-text: #111827;
  --donut-sub: #9ca3af;
  --transition: .2s cubic-bezier(.4,0,.2,1);
}
[data-theme="dark"] {
  --bg: #0f1117;
  --card: #1a1d27;
  --card-hover: #21242f;
  --border: #2a2d3a;
  --border-subtle: #22252f;
  --text: #f1f3f5;
  --text-2: #a1a7b4;
  --text-3: #5c6370;
  --accent: #818cf8;
  --accent-soft: rgba(129,140,248,.12);
  --green: #4ade80;
  --green-soft: rgba(74,222,128,.1);
  --red: #f87171;
  --red-soft: rgba(248,113,113,.1);
  --amber: #fbbf24;
  --amber-soft: rgba(251,191,36,.1);
  --shadow: 0 1px 2px rgba(0,0,0,.2);
  --shadow-md: 0 4px 12px rgba(0,0,0,.3);
  --shadow-lg: 0 12px 24px rgba(0,0,0,.4);
  --donut-track: #2a2d3a;
  --donut-text: #f1f3f5;
  --donut-sub: #5c6370;
}

/* ── Reset ──────────────────────────────── */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.5;transition:background var(--transition),color var(--transition)}
a{text-decoration:none;color:inherit}

/* ── Header ─────────────────────────────── */
.hdr{position:fixed;top:0;left:0;right:0;z-index:100;height:var(--header-h);background:var(--card);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 28px;transition:background var(--transition),border var(--transition)}
.hdr-brand{display:flex;align-items:center;gap:12px}
.hdr-logo{width:34px;height:34px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px;letter-spacing:-.5px}
.hdr-title{font-size:16px;font-weight:700}
.hdr-sub{font-size:11px;color:var(--text-3);letter-spacing:.2px}
.hdr-right{margin-left:auto;display:flex;align-items:center;gap:16px}
.hdr-meta{text-align:right}
.hdr-meta-l{font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.6px}
.hdr-meta-v{font-size:13px;font-weight:600}
.hdr-badge{padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700;color:#fff;background:${totalFailed > 0 ? "var(--red)" : "var(--green)"}}

/* ── Theme toggle ───────────────────────── */
.theme-toggle{width:36px;height:36px;border:1px solid var(--border);background:var(--card);border-radius:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all var(--transition);color:var(--text-2);flex-shrink:0}
.theme-toggle:hover{background:var(--card-hover);border-color:var(--accent);color:var(--accent)}
.theme-toggle svg{width:18px;height:18px}
.icon-sun,.icon-moon{transition:opacity .15s}
[data-theme="dark"] .icon-sun{display:none}
[data-theme="light"] .icon-moon,[data-theme=""] .icon-moon{display:none}

/* ── Sidebar ────────────────────────────── */
.side{position:fixed;top:var(--header-h);left:0;bottom:0;width:var(--sidebar-w);background:var(--card);border-right:1px solid var(--border);overflow-y:auto;padding:20px 0;z-index:50;transition:background var(--transition),border var(--transition)}
.side-summary{margin:0 14px 20px;padding:20px 16px;background:var(--bg);border-radius:var(--radius);border:1px solid var(--border);transition:background var(--transition),border var(--transition)}
.donut-wrap{display:flex;justify-content:center;margin-bottom:14px}
.stats-row{display:flex;justify-content:space-around}
.stat{text-align:center}
.stat-n{font-size:18px;font-weight:700}
.stat-l{font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.5px}
.stat--p .stat-n{color:var(--green)}
.stat--f .stat-n{color:var(--red)}
.stat--s .stat-n{color:var(--amber)}
.side-title{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--text-3);padding:0 20px;margin-bottom:6px;font-weight:700}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 20px;font-size:13px;font-weight:500;color:var(--text-2);cursor:pointer;border-left:3px solid transparent;transition:all .12s}
.nav-item:hover{background:var(--accent-soft);color:var(--accent)}
.nav-item.active{background:var(--accent-soft);color:var(--accent);border-left-color:var(--accent)}
.nav-icon{display:flex;align-items:center;flex-shrink:0}
.nav-icon svg{width:18px;height:18px}
.nav-label{flex:1}
.nav-badge{font-size:9px;font-weight:700;padding:2px 7px;border-radius:8px;letter-spacing:.4px}
.nav-badge--passed{background:var(--green-soft);color:var(--green)}
.nav-badge--failed{background:var(--red-soft);color:var(--red)}
.nav-badge--skipped{background:var(--amber-soft);color:var(--amber)}

/* ── Main ───────────────────────────────── */
.main{margin-left:var(--sidebar-w);margin-top:var(--header-h);padding:28px;min-height:calc(100vh - var(--header-h))}

/* ── Timeline ───────────────────────────── */
.timeline{display:flex;align-items:center;justify-content:center;padding:16px 24px;background:var(--card);border-radius:var(--radius);border:1px solid var(--border);margin-bottom:24px;flex-wrap:wrap;gap:4px;transition:background var(--transition),border var(--transition)}
.tl-step{display:flex;align-items:center;gap:8px;padding:4px 0}
.tl-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.tl--passed .tl-dot{background:var(--green);box-shadow:0 0 0 3px var(--green-soft)}
.tl--failed .tl-dot{background:var(--red);box-shadow:0 0 0 3px var(--red-soft)}
.tl--skipped .tl-dot{background:var(--amber);box-shadow:0 0 0 3px var(--amber-soft)}
.tl-name{font-size:12px;font-weight:600;color:var(--text)}
.tl-dur{font-size:11px;color:var(--text-3);font-weight:500}
.tl-line{width:32px;height:1.5px;background:var(--border);flex-shrink:0}

/* ── Test panel ─────────────────────────── */
.test-panel{display:none;animation:fadeIn .25s ease}
.test-panel.active{display:block}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

.panel-header{background:var(--card);border-radius:var(--radius);border:1px solid var(--border);padding:24px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap;transition:background var(--transition),border var(--transition)}
.panel-header-left{display:flex;gap:14px;align-items:flex-start;flex:1;min-width:280px}
.panel-icon{flex-shrink:0}
.panel-icon svg{width:26px;height:26px}
.panel-info h2{font-size:20px;font-weight:700;margin-bottom:2px}
.panel-info p{font-size:13px;color:var(--text-2);line-height:1.55}
.panel-stats{display:flex;gap:20px;flex-shrink:0}
.panel-stat{text-align:center}
.panel-stat-label{display:block;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;font-weight:600}
.panel-stat-value{font-size:15px;font-weight:700}
.pill{display:inline-block;padding:3px 12px;border-radius:16px;font-size:11px;font-weight:700;letter-spacing:.4px}
.pill--passed{background:var(--green-soft);color:var(--green)}
.pill--failed{background:var(--red-soft);color:var(--red)}
.pill--skipped{background:var(--amber-soft);color:var(--amber)}

/* ── Section (collapsible) ──────────────── */
.section{background:var(--card);border-radius:var(--radius);border:1px solid var(--border);margin-bottom:16px;overflow:hidden;transition:background var(--transition),border var(--transition)}
.section-hd{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;cursor:pointer;user-select:none;transition:background .12s}
.section-hd:hover{background:var(--card-hover)}
.section-hd h3{font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px}
.section-hd h3 svg{color:var(--text-3)}
.badge{background:var(--accent-soft);color:var(--accent);font-size:11px;padding:1px 8px;border-radius:8px;font-weight:700}
.chev{color:var(--text-3);transition:transform .2s}
.section-bd{padding:4px 20px 20px}
.section-bd.closed{display:none}

/* ── Screenshots ────────────────────────── */
.ss-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.ss-card{border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;cursor:pointer;transition:all var(--transition);background:var(--card)}
.ss-card:hover{box-shadow:var(--shadow-lg);transform:translateY(-2px);border-color:var(--accent)}
.ss-img-wrap{position:relative;background:var(--bg)}
.ss-img-wrap img{width:100%;display:block;height:180px;object-fit:cover;object-position:top}
.ss-overlay{position:absolute;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .15s}
.ss-card:hover .ss-overlay{opacity:1}
.ss-info{padding:10px 12px;display:flex;align-items:center;gap:8px}
.ss-step{flex-shrink:0;background:var(--accent-soft);color:var(--accent);font-size:9px;font-weight:700;padding:2px 7px;border-radius:5px;text-transform:uppercase;letter-spacing:.3px}
.ss-label{font-size:12px;color:var(--text-2);line-height:1.3}

/* ── Video ──────────────────────────────── */
.video-wrap{border-radius:var(--radius-sm);overflow:hidden;border:1px solid var(--border);background:#000}
.video-wrap video{width:100%;display:block}

/* ── Error ──────────────────────────────── */
.error-block{background:var(--red-soft);border:1px solid color-mix(in srgb,var(--red) 20%,transparent);border-radius:var(--radius);margin-bottom:16px;overflow:hidden}
.error-title{display:flex;align-items:center;gap:8px;padding:12px 18px;font-size:13px;font-weight:600;color:var(--red);border-bottom:1px solid color-mix(in srgb,var(--red) 15%,transparent)}
.error-body{padding:14px 18px;font-size:12px;color:var(--red);font-family:var(--mono);white-space:pre-wrap;line-height:1.6;margin:0;opacity:.85}

/* ── Empty state ────────────────────────── */
.empty-state{text-align:center;padding:36px 20px;color:var(--text-3);font-size:13px}

/* ── Lightbox ───────────────────────────── */
.lb{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.88);display:none;align-items:center;justify-content:center;padding:40px;cursor:zoom-out;backdrop-filter:blur(8px)}
.lb.open{display:flex}
.lb img{max-width:100%;max-height:100%;object-fit:contain;border-radius:var(--radius-sm);box-shadow:0 20px 60px rgba(0,0,0,.6)}
.lb-caption{position:absolute;bottom:28px;left:50%;transform:translateX(-50%);color:#fff;font-size:13px;background:rgba(0,0,0,.5);padding:7px 20px;border-radius:16px;white-space:nowrap;font-weight:500;backdrop-filter:blur(4px)}
.lb-close{position:absolute;top:20px;right:24px;width:38px;height:38px;border:none;background:rgba(255,255,255,.1);color:#fff;border-radius:50%;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;transition:background .12s;backdrop-filter:blur(4px)}
.lb-close:hover{background:rgba(255,255,255,.25)}
.lb-nav{position:absolute;top:50%;transform:translateY(-50%);width:42px;height:42px;border:none;background:rgba(255,255,255,.1);color:#fff;border-radius:50%;cursor:pointer;font-size:20px;display:flex;align-items:center;justify-content:center;transition:background .12s;backdrop-filter:blur(4px)}
.lb-nav:hover{background:rgba(255,255,255,.25)}
.lb-prev{left:20px}
.lb-next{right:20px}
.lb-counter{position:absolute;top:24px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,.6);font-size:12px;font-weight:500}

/* ── Footer ─────────────────────────────── */
.footer{text-align:center;padding:20px;font-size:11px;color:var(--text-3);margin-top:32px;letter-spacing:.2px}

/* ── Responsive ─────────────────────────── */
@media(max-width:900px){
  .side{display:none}
  .main{margin-left:0}
  .panel-header{flex-direction:column}
  .ss-grid{grid-template-columns:1fr}
  .hdr-meta{display:none}
}
</style>
</head>
<body data-theme="light">

<header class="hdr">
  <div class="hdr-brand">
    <div class="hdr-logo">AS</div>
    <div>
      <div class="hdr-title">AskSam Automation</div>
      <div class="hdr-sub">Test Execution Report</div>
    </div>
  </div>
  <div class="hdr-right">
    <div class="hdr-meta"><div class="hdr-meta-l">Duration</div><div class="hdr-meta-v">${totalDuration.toFixed(1)}s</div></div>
    <div class="hdr-meta"><div class="hdr-meta-l">Environment</div><div class="hdr-meta-v">Production</div></div>
    <div class="hdr-badge">${totalFailed > 0 ? totalFailed + " Failed" : "All Passed"}</div>
    <button class="theme-toggle" onclick="toggleTheme()" title="Toggle theme">
      <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
      <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
    </button>
  </div>
</header>

<aside class="side">
  <div class="side-summary">
    <div class="donut-wrap">
      <svg width="${donutSize}" height="${donutSize}" viewBox="0 0 ${donutSize} ${donutSize}">
        <circle cx="${donutSize / 2}" cy="${donutSize / 2}" r="${radius}" fill="none" stroke="var(--donut-track)" stroke-width="${strokeWidth}"/>
        ${arcs}
        <text x="${donutSize / 2}" y="${donutSize / 2 - 4}" text-anchor="middle" font-size="26" font-weight="800" fill="var(--donut-text)">${passRate}%</text>
        <text x="${donutSize / 2}" y="${donutSize / 2 + 14}" text-anchor="middle" font-size="10" fill="var(--donut-sub)" font-weight="500">PASS RATE</text>
      </svg>
    </div>
    <div class="stats-row">
      <div class="stat stat--p"><div class="stat-n">${totalPassed}</div><div class="stat-l">Passed</div></div>
      <div class="stat stat--f"><div class="stat-n">${totalFailed}</div><div class="stat-l">Failed</div></div>
      <div class="stat stat--s"><div class="stat-n">${totalSkipped}</div><div class="stat-l">Skipped</div></div>
    </div>
  </div>
  <div class="side-title">Test Cases</div>
  ${navItems}
</aside>

<main class="main">
  <div class="timeline">${timelineSteps}</div>
  ${testPanels}
  <div class="footer">Generated on ${timestamp} &middot; Playwright + Node.js &middot; AskSam QA Automation</div>
</main>

<div class="lb" id="lb" onclick="closeLb()">
  <button class="lb-close" onclick="closeLb()">&times;</button>
  <button class="lb-nav lb-prev" onclick="navLb(event,-1)">&#8249;</button>
  <button class="lb-nav lb-next" onclick="navLb(event,1)">&#8250;</button>
  <div class="lb-counter" id="lb-counter"></div>
  <img id="lb-img" src="" alt=""/>
  <div class="lb-caption" id="lb-caption"></div>
</div>

<script>
/* ── Theme toggle ─────────────────────── */
function toggleTheme(){
  const html=document.documentElement;
  const body=document.body;
  const current=body.getAttribute('data-theme');
  const next=current==='dark'?'light':'dark';
  body.setAttribute('data-theme',next);
  localStorage.setItem('asksam-theme',next);
}
(function(){
  const saved=localStorage.getItem('asksam-theme');
  if(saved)document.body.setAttribute('data-theme',saved);
  else if(window.matchMedia('(prefers-color-scheme:dark)').matches)document.body.setAttribute('data-theme','dark');
})();

/* ── Navigation ───────────────────────── */
function showTest(id,el){
  document.querySelectorAll('.test-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if(el)el.classList.add('active');
}

/* ── Collapsible sections ─────────────── */
function toggleSection(hd){
  const bd=hd.nextElementSibling;
  const ch=hd.querySelector('.chev');
  if(bd.classList.contains('open')){bd.classList.replace('open','closed');if(ch)ch.style.transform='rotate(0)'}
  else{bd.classList.replace('closed','open');if(ch)ch.style.transform='rotate(180deg)'}
}

/* ── Lightbox with prev/next ──────────── */
let lbImages=[], lbIdx=0;
function collectImages(){
  const active=document.querySelector('.test-panel.active');
  if(!active)return[];
  return Array.from(active.querySelectorAll('.ss-card')).map(c=>({
    src:c.querySelector('img').src,
    label:c.querySelector('.ss-label')?.textContent?.trim()||''
  }));
}
function openLightbox(src,caption){
  event.stopPropagation();
  lbImages=collectImages();
  lbIdx=lbImages.findIndex(i=>i.src.includes(src.replace('screenshots/',''))); if(lbIdx<0)lbIdx=0;
  showLbSlide();
  document.getElementById('lb').classList.add('open');
  document.body.style.overflow='hidden';
}
function showLbSlide(){
  const item=lbImages[lbIdx];
  if(!item)return;
  document.getElementById('lb-img').src=item.src;
  document.getElementById('lb-caption').textContent=item.label;
  document.getElementById('lb-counter').textContent=(lbIdx+1)+' / '+lbImages.length;
}
function closeLb(){document.getElementById('lb').classList.remove('open');document.body.style.overflow=''}
function navLb(e,dir){e.stopPropagation();lbIdx=(lbIdx+dir+lbImages.length)%lbImages.length;showLbSlide()}
document.addEventListener('keydown',e=>{
  if(!document.getElementById('lb').classList.contains('open'))return;
  if(e.key==='Escape')closeLb();
  if(e.key==='ArrowLeft')navLb(e,-1);
  if(e.key==='ArrowRight')navLb(e,1);
});
</script>
</body>
</html>`;
}

// ── Main runner ──────────────────────────────────────────────────────────────

async function runDashboard() {
  ensureDirs();
  const results = [];

  const browser = await chromium.launch({
    headless: env.headless,
    slowMo: env.headless ? 0 : 50,
  });

  for (const test of tests) {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`  Running: ${test.name}`);
    console.log(`${"═".repeat(60)}`);

    const result = {
      id: test.id,
      name: test.name,
      status: "passed",
      screenshots: [],
      video: null,
      error: null,
      duration: "0s",
    };

    const start = Date.now();
    let context;

    try {
      const contextOptions = {
        recordVideo: {
          dir: VIDEOS_DIR,
          size: { width: 1280, height: 720 },
        },
      };

      // Add auth state for tests that need it
      if (test.id !== "login" && fs.existsSync(env.authStatePath)) {
        contextOptions.storageState = env.authStatePath;
      }

      context = await browser.newContext(contextOptions);
      const page = await context.newPage();
      page.setDefaultTimeout(env.navigationTimeout);

      await test.run(page, result.screenshots);

      result.status = "passed";
      console.log(`  PASSED (${elapsed(start)})`);
    } catch (err) {
      result.status = "failed";
      result.error = err.message;
      console.error(`  FAILED: ${err.message}`);
      // Capture failure screenshot for debugging
      try {
        const pages = context?.pages() || [];
        for (const p of pages) {
          const url = p.url();
          console.error(`  Page URL at failure: ${url}`);
          result.screenshots.push(
            await screenshot(p, `${test.id}-FAIL`)
          );
        }
      } catch {}
    }

    result.duration = elapsed(start);

    // Close context to finalize video
    if (context) {
      const pages = context.pages();
      const mainPage = pages[0];
      let videoObj = null;
      if (mainPage) {
        videoObj = mainPage.video();
      }
      // Close context first — this finalizes all video files
      await context.close();

      // Rename the main page's video to a meaningful name
      if (videoObj) {
        try {
          const videoPath = await videoObj.path();
          const destName = `${test.id}.webm`;
          const destPath = path.join(VIDEOS_DIR, destName);
          if (fs.existsSync(videoPath)) {
            if (videoPath !== destPath) {
              fs.renameSync(videoPath, destPath);
            }
            result.video = `videos/${destName}`;
          }
        } catch {
          // video may not be available
        }
      }

      // Clean up extra unnamed video files from secondary pages (new tabs)
      const extraVideos = fs
        .readdirSync(VIDEOS_DIR)
        .filter((f) => /^[a-f0-9]{32}\.webm$/.test(f));
      for (const f of extraVideos) {
        try {
          fs.unlinkSync(path.join(VIDEOS_DIR, f));
        } catch {}
      }
    }

    results.push(result);
  }

  await browser.close();

  // Generate HTML dashboard
  const html = generateDashboard(results);
  const dashboardPath = path.join(REPORTS_DIR, "dashboard.html");
  fs.writeFileSync(dashboardPath, html);
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  Dashboard saved to: ${dashboardPath}`);
  console.log(`${"═".repeat(60)}\n`);

  // Summary
  const passed = results.filter((r) => r.status === "passed").length;
  const failed = results.filter((r) => r.status === "failed").length;
  console.log(
    `Results: ${passed} passed, ${failed} failed out of ${results.length} tests.`
  );

}

runDashboard().catch((err) => {
  console.error("Dashboard runner failed:", err.message);
  process.exit(1);
});
