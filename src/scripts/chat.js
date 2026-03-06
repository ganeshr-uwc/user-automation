const fs = require("fs");
const env = require("../config/env");
const { getBrowser, closeBrowser } = require("../utils/browser");

const TEST_MESSAGES = [
  "I've been feeling really anxious lately, what can I do?",
  "How can I improve my sleep quality?",
  "What are some coping strategies for stress?",
  "I feel overwhelmed at work, any advice?",
  "Can you suggest some mindfulness exercises?",
];

const CHAT_CONTAINER_SEL = 'main div[class*="overflow-y-scroll"]';
const BOT_MESSAGE_SEL = `${CHAT_CONTAINER_SEL} > div[class*="justify-start"]`;

/**
 * Sends each message in TEST_MESSAGES on the /chat page and waits for a
 * bot reply after each one. Logs pass/fail per message and a final summary.
 */
async function chat() {
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

  let passed = 0;

  try {
    console.log(`Opening chat: ${env.chatUrl}`);
    await page.goto(env.chatUrl, { waitUntil: "domcontentloaded" });

    const chatInput = page.getByPlaceholder("Ask Sam");
    await chatInput.waitFor({
      state: "visible",
      timeout: env.navigationTimeout,
    });
    console.log("Chat input ready.");

    await waitForGreeting(page);

    for (let i = 0; i < TEST_MESSAGES.length; i++) {
      const msg = TEST_MESSAGES[i];
      const label = `Message ${i + 1}/${TEST_MESSAGES.length}`;

      try {
        console.log(`${label} — Sending: "${msg}"`);

        const beforeBotCount = await getBotMessageCount(page);
        console.log(`  Bot messages before send: ${beforeBotCount}`);

        await chatInput.fill(msg);
        await page.keyboard.press("Enter");

        await waitForBotReply(page, beforeBotCount);

        const afterBotCount = await getBotMessageCount(page);
        console.log(`  Bot messages after reply: ${afterBotCount}`);
        console.log(`${label} — Reply received: OK\n`);
        passed++;

        await chatInput.waitFor({
          state: "visible",
          timeout: env.chatReplyTimeout,
        });
      } catch (err) {
        console.error(`${label} — FAIL: ${err.message}\n`);
      }
    }

    console.log(
      `Chat test complete: ${passed}/${TEST_MESSAGES.length} replies received.`
    );

    if (passed < TEST_MESSAGES.length) {
      throw new Error(
        `Chat verification failed: only ${passed}/${TEST_MESSAGES.length} replies received.`
      );
    }
  } catch (error) {
    throw new Error(`Chat flow failed: ${error.message}`);
  } finally {
    await context.close();
    await closeBrowser();
  }
}

/**
 * Waits for an optional bot greeting that appears on page load.
 * If one shows up within a short window we let it settle;
 * if not, the page is showing prompt cards and we proceed immediately.
 */
async function waitForGreeting(page) {
  console.log("Checking for initial bot greeting…");
  try {
    await page.waitForFunction(
      (sel) => document.querySelectorAll(sel).length >= 1,
      BOT_MESSAGE_SEL,
      { timeout: 8000, polling: 500 }
    );
    console.log("Bot greeting detected — waiting for it to finish streaming…");
    await waitForStreamingDone(page);
    console.log("Greeting settled.\n");
  } catch {
    console.log("No bot greeting present — starting with prompt cards.\n");
  }
}

/**
 * Returns the current number of bot-reply elements on the page.
 * Bot replies are direct children of the chat scroll container
 * aligned with justify-start (as opposed to user messages which
 * use justify-end).
 */
async function getBotMessageCount(page) {
  return page.evaluate((sel) => {
    return document.querySelectorAll(sel).length;
  }, BOT_MESSAGE_SEL);
}

/**
 * Waits until a new bot reply appears after sending a message.
 * Uses bot-message-only counting so we only need botCount > prevBotCount,
 * eliminating the fragile "+2" total-count assumption.
 * Also waits for any streaming/typing animation to finish.
 */
async function waitForBotReply(page, botCountBefore) {
  const timeout = env.chatReplyTimeout;

  await page.waitForFunction(
    ({ prevBotCount, sel }) => {
      const botMsgs = document.querySelectorAll(sel);
      return botMsgs.length > prevBotCount;
    },
    { prevBotCount: botCountBefore, sel: BOT_MESSAGE_SEL },
    { timeout, polling: 1000 }
  );

  await waitForStreamingDone(page);
}

/**
 * Polls until no streaming/typing indicator is visible and the
 * last bot message text has stopped growing (content fully rendered).
 */
async function waitForStreamingDone(page) {
  let prevText = "";
  let stableCount = 0;
  const requiredStableChecks = 3;

  while (stableCount < requiredStableChecks) {
    await page.waitForTimeout(1000);

    const currentText = await page.evaluate((sel) => {
      const botMsgs = document.querySelectorAll(sel);
      if (botMsgs.length === 0) return "";
      const last = botMsgs[botMsgs.length - 1];
      return last.textContent || "";
    }, BOT_MESSAGE_SEL);

    if (currentText === prevText && currentText.length > 0) {
      stableCount++;
    } else {
      stableCount = 0;
    }
    prevText = currentText;
  }
}

if (require.main === module) {
  chat().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { chat };
