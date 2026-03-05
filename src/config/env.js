const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const env = {
  headless: process.env.HEADLESS !== "false",

  targetUrl: process.env.TARGET_URL,
  protectedUrl: process.env.PROTECTED_URL,

  loginEmail: process.env.LOGIN_EMAIL,
  otpCode: process.env.OTP_CODE,

  signupUrl: process.env.SIGNUP_URL || "https://ai.asksam.com.au/sign-up",
  signupEmail: process.env.SIGNUP_EMAIL,
  signupFirstName: process.env.SIGNUP_FIRST_NAME || "Test",
  signupLastName: process.env.SIGNUP_LAST_NAME || "Automation",

  selectorEmail: process.env.SELECTOR_EMAIL || 'input[name="identifier"]',
  selectorContinue:
    process.env.SELECTOR_CONTINUE || 'button:has-text("Continue")',
  selectorOtp: process.env.SELECTOR_OTP || '[autocomplete="one-time-code"]',
  selectorFirstName: 'input[name="firstName"]',
  selectorLastName: 'input[name="lastName"]',
  selectorEmailAddress: 'input[name="emailAddress"]',
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

  automateEmailPrefix: process.env.AUTOMATE_EMAIL_PREFIX || "test.auto.",
  automateEmailTag: process.env.AUTOMATE_EMAIL_TAG || "clerk_test",
  automateEmailDomain: process.env.AUTOMATE_EMAIL_DOMAIN || "tmail.com",

  onboardFirstName: process.env.ONBOARD_FIRST_NAME || "Test",
  onboardMiddleName: process.env.ONBOARD_MIDDLE_NAME || "",
  onboardLastName: process.env.ONBOARD_LAST_NAME || "User",
  onboardGender: process.env.ONBOARD_GENDER || "Male",
  onboardDob: process.env.ONBOARD_DOB || "2000-01-15",
  onboardReferralCode: process.env.ONBOARD_REFERRAL_CODE || "DEMO1024",

  navigationTimeout: parseInt(process.env.NAVIGATION_TIMEOUT, 10) || 30_000,
  stepTransitionTimeout:
    parseInt(process.env.STEP_TRANSITION_TIMEOUT, 10) || 10_000,
  onboardDetectTimeout:
    parseInt(process.env.ONBOARD_DETECT_TIMEOUT, 10) || 8_000,

  chatUrl: process.env.CHAT_URL || "https://ai.asksam.com.au/chat",
  chatReplyTimeout:
    parseInt(process.env.CHAT_REPLY_TIMEOUT, 10) || 60_000,
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
