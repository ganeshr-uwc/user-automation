const fs = require("fs");
const env = require("../config/env");
const { getBrowser, closeBrowser } = require("../utils/browser");

/**
 * Navigates to My Appointments via the sidebar menu and clicks
 * Book Appointment. Verifies the booking page loads successfully.
 */
async function bookAppointment() {
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
    // ── Step 1: Navigate to the app ─────────────────────────────────────
    const appUrl = env.protectedUrl;
    console.log(`Opening app: ${appUrl}`);
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });

    // ── Step 2: Open sidebar menu ───────────────────────────────────────
    console.log("Opening sidebar menu…");
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
    console.log("Sidebar opened.");

    // ── Step 3: Click "My Appointments" ─────────────────────────────────
    console.log('Looking for "My Appointments" menu item…');
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
    console.log('"My Appointments" clicked.');

    // ── Step 4: Click "Book Appointment" ────────────────────────────────
    console.log('Looking for "Book Appointment" button…');
    const bookBtn = page
      .getByRole("button", { name: /book appointment/i })
      .or(page.getByRole("link", { name: /book appointment/i }))
      .or(page.getByText("Book Appointment", { exact: false }))
      .first();

    await bookBtn.waitFor({
      state: "visible",
      timeout: env.stepTransitionTimeout,
    });

    // "Book Appointment" may open a new tab — listen before clicking
    const [bookingPage] = await Promise.all([
      context.waitForEvent("page"),
      bookBtn.click(),
    ]);
    await bookingPage.waitForLoadState("domcontentloaded");
    console.log(`"Book Appointment" opened: ${bookingPage.url()}`);

    // ── Step 5: Search for professional ─────────────────────────────────
    const searchQuery = "Antony Smith";
    console.log(`Searching for "${searchQuery}"…`);

    const searchInput = bookingPage.getByPlaceholder(
      /search professionals by name/i
    );
    await searchInput.waitFor({
      state: "visible",
      timeout: env.stepTransitionTimeout,
    });
    await searchInput.fill(searchQuery);
    await bookingPage.keyboard.press("Enter");
    console.log("Search submitted.");

    // Wait for results to load
    await bookingPage.waitForTimeout(3000);

    // Verify search results contain the professional
    const resultCard = bookingPage
      .getByText(searchQuery, { exact: false })
      .first();

    try {
      await resultCard.waitFor({
        state: "visible",
        timeout: env.stepTransitionTimeout,
      });
      console.log(`Found professional: "${searchQuery}".`);
    } catch {
      console.log(
        `No results found for "${searchQuery}" — verify the name is correct.`
      );
    }

    console.log("Book Appointment flow completed successfully.");
  } catch (error) {
    throw new Error(`Book Appointment flow failed: ${error.message}`);
  } finally {
    await context.close();
    await closeBrowser();
  }
}

if (require.main === module) {
  bookAppointment().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { bookAppointment };
