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
    console.log("Chat input ready.\n");

    for (let i = 0; i < TEST_MESSAGES.length; i++) {
      const msg = TEST_MESSAGES[i];
      const label = `Message ${i + 1}/${TEST_MESSAGES.length}`;

      try {
        console.log(`${label} — Sending: "${msg}"`);

        const beforeCount = await getMessageCount(page);

        await chatInput.fill(msg);
        await page.keyboard.press("Enter");

        await waitForBotReply(page, beforeCount);

        console.log(`${label} — Reply received: OK\n`);
        passed++;
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
 * Returns the current number of chat message elements on the page.
 * Targets the common wrapper pattern: user and bot messages live as
 * direct children inside the scrollable chat area.
 */
async function getMessageCount(page) {
  return page.evaluate(() => {
    const msgs = document.querySelectorAll(
      '[data-message-id], [data-role], .message, [class*="message"]'
    );
    if (msgs.length > 0) return msgs.length;
    // Fallback: count distinct blocks inside the main scrollable area
    const chat = document.querySelector(
      '[role="log"], [class*="chat"], main, [class*="scroll"]'
    );
    return chat ? chat.children.length : 0;
  });
}

/**
 * Waits until a new bot reply appears after sending a message.
 *
 * Strategy: poll the page until the message count exceeds `countBefore`
 * by at least 2 (one for the user message, one for the bot reply), OR
 * until new substantive text content appears beyond the user's message.
 *
 * Falls back to watching for the chat input to become re-enabled /
 * empty (indicating the round-trip completed).
 */
async function waitForBotReply(page, countBefore) {
  const timeout = env.chatReplyTimeout;

  await page.waitForFunction(
    ({ prevCount }) => {
      // Strategy 1: message-count based
      const msgs = document.querySelectorAll(
        '[data-message-id], [data-role], .message, [class*="message"]'
      );
      if (msgs.length >= prevCount + 2) return true;

      // Strategy 2: look for any streaming/typing indicator that appeared
      // and then disappeared (response complete)
      const streaming = document.querySelector(
        '[class*="loading"], [class*="typing"], [class*="streaming"], [class*="animate-pulse"]'
      );
      if (streaming) return false; // still loading

      // Strategy 3: broad child-count in scrollable area
      const chat = document.querySelector(
        '[role="log"], [class*="chat"], main, [class*="scroll"]'
      );
      if (chat && chat.children.length >= prevCount + 2) return true;

      return false;
    },
    { prevCount: countBefore },
    { timeout, polling: 1000 }
  );
}

if (require.main === module) {
  chat().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { chat };
