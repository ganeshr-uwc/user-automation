const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const env = {
  headless: process.env.HEADLESS !== "false",

  targetUrl: process.env.TARGET_URL,
  protectedUrl: process.env.PROTECTED_URL,

  loginEmail: process.env.LOGIN_EMAIL,
  otpCode: process.env.OTP_CODE,

  selectorEmail: process.env.SELECTOR_EMAIL || 'input[name="identifier"]',
  selectorContinue:
    process.env.SELECTOR_CONTINUE || 'button:has-text("Continue")',
  selectorOtp: process.env.SELECTOR_OTP || '[autocomplete="one-time-code"]',
  authSuccessUrl:
    process.env.AUTH_SUCCESS_URL || "https://ai.asksam.com.au/chat",

  authStatePath: path.resolve(
    __dirname,
    "../..",
    process.env.AUTH_STATE_PATH || "auth.json"
  ),
  screenshotPath: path.resolve(
    __dirname,
    "../..",
    process.env.SCREENSHOT_PATH || "screenshots/task-result.png"
  ),

  navigationTimeout: parseInt(process.env.NAVIGATION_TIMEOUT, 10) || 30_000,
  stepTransitionTimeout:
    parseInt(process.env.STEP_TRANSITION_TIMEOUT, 10) || 10_000,
};

const requiredVars = ["targetUrl", "protectedUrl", "loginEmail", "otpCode"];
for (const key of requiredVars) {
  if (!env[key]) {
    throw new Error(
      `Missing required environment variable for "${key}". Check your .env file.`
    );
  }
}

module.exports = env;
