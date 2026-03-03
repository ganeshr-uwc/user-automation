const { chromium } = require("playwright");
const env = require("../config/env");

let browserInstance = null;

async function getBrowser() {
  if (browserInstance?.isConnected()) {
    return browserInstance;
  }

  try {
    browserInstance = await chromium.launch({
      headless: env.headless,
      slowMo: env.headless ? 0 : 50,
    });
    return browserInstance;
  } catch (error) {
    throw new Error(`Failed to launch browser: ${error.message}`);
  }
}

async function closeBrowser() {
  if (browserInstance?.isConnected()) {
    await browserInstance.close();
    browserInstance = null;
  }
}

module.exports = { getBrowser, closeBrowser };
