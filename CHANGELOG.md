# Changelog

All notable changes to this project will be documented in this file.

## [1.8.1] - 2026-03-06

### Fix
- Fixed chat reply detection: replaced generic DOM selectors (`[data-message-id]`, `[data-role]`, `.message`) that never matched AskSam's actual markup with correct selectors targeting the scrollable chat container (`overflow-y-scroll`) and bot message wrappers (`justify-start`).
- Replaced fragile `prevCount + 2` total-message-count detection with bot-message-only counting (`botCount > prevBotCount`), eliminating false negatives caused by the +2 assumption.
- Added `waitForStreamingDone()` that polls until the last bot message text stabilises, ensuring the full response is rendered before proceeding.
- Added `waitForGreeting()` to handle the optional bot "Hi" greeting on page load without throwing off message counts.
- Added input-readiness re-check between messages so the next send waits for the chat input to be visible again after streaming.

## [1.8.0] - 2026-03-05

### Minor change
- Onboarding is now conditional: the welcome popup is detected with a short timeout (~8s) and skipped gracefully if the user has already completed onboarding, preventing failures for returning users.
- Added chat reply verification (`src/scripts/chat.js`): sends 5 mental-health-related test messages on `/chat` and verifies that Sam replies to each one, logging pass/fail per message and a summary.
- `npm run automate` now chains: sign-in/sign-up -> conditional onboarding -> chat reply verification.
- Added `npm run chat` command to run the chat test standalone.
- Added `CHAT_REPLY_TIMEOUT` and `ONBOARD_DETECT_TIMEOUT` environment variables.

## [1.7.0] - 2026-03-05

### Minor change
- Added Step 8 to onboarding script: waits for the post-onboarding popup to appear and clicks the "Skip" button to dismiss it before saving the session.

## [1.6.0] - 2026-03-03

### Minor change
- `npm run automate` now automatically runs the onboarding wizard after login or signup, combining both flows into a single command.

## [1.5.1] - 2026-03-03

### Minor change
- Added Step 7 to onboarding script: selects the "Google" radio option (how did you hear about us) before clicking "Complete Profile".

## [1.5.0] - 2026-03-03

### Minor change
- Added onboarding automation script (`src/scripts/onboard.js`) that handles the full AskSam post-auth onboarding wizard: welcome popup, terms & conditions agreement, name entry (first/middle/last), gender selection, date of birth, and referral code verification.
- Added `npm run onboard` command and orchestrator support via `node src/index.js onboard`.
- Added onboarding-specific environment variables: `ONBOARD_FIRST_NAME`, `ONBOARD_MIDDLE_NAME`, `ONBOARD_LAST_NAME`, `ONBOARD_GENDER`, `ONBOARD_DOB`, `ONBOARD_REFERRAL_CODE`.

## [1.4.0] - 2026-03-03

### Minor change
- Added `npm run automate` flow that attempts Clerk login with `LOGIN_EMAIL` and, if Clerk reports "user not found", auto-generates a unique signup email and creates the account via the sign-up flow.
- Auto-generated signup emails use the configurable pattern `{prefix}{timestamp}+{tag}@{domain}` with defaults `test.auto.{ts}+clerk_test@tmail.com`.
- Added optional environment variables `AUTOMATE_EMAIL_PREFIX`, `AUTOMATE_EMAIL_TAG`, and `AUTOMATE_EMAIL_DOMAIN` for controlling generated email format.
- Updated orchestrator (`src/index.js`) to support `node src/index.js automate` via the main entry point.

## [1.3.0] - 2026-03-03

### Minor change
- Added Clerk sign-up automation script (`src/scripts/signup.js`) that handles the full registration flow: first name, last name, email entry, then OTP verification.
- Added signup-specific environment variables (`SIGNUP_URL`, `SIGNUP_EMAIL`, `SIGNUP_FIRST_NAME`, `SIGNUP_LAST_NAME`) and corresponding Clerk form selectors.
- Added `npm run signup` command to run the sign-up flow standalone.
- Updated orchestrator (`src/index.js`) to support `node src/index.js signup` for running sign-up via the main entry point.

## [1.2.0] - 2026-03-03

### Major change
- Switched from password-based to OTP-based Clerk authentication flow.
- Login script now handles the two-step OTP flow: email entry on `/sign-in`, then OTP code entry on `/sign-in/factor-one`.
- Clerk auto-submits after all 6 OTP digits are filled; script includes a fallback to click Continue if auto-submit doesn't trigger.

### Minor change
- Replaced `LOGIN_PASSWORD` / `SELECTOR_PASSWORD` env vars with `OTP_CODE` / `SELECTOR_OTP`.
- Renamed `SELECTOR_AUTH_SUCCESS` to `AUTH_SUCCESS_URL` for clarity.
- Updated README with OTP-specific flow documentation and troubleshooting.

## [1.1.0] - 2026-03-03

### Major change
- Adapted login script for Clerk's multi-step authentication flow (email → password → redirect).
- Added `SELECTOR_CONTINUE`, `SELECTOR_AUTH_SUCCESS`, and `STEP_TRANSITION_TIMEOUT` environment variables for Clerk step handling.
- Login script now waits for each Clerk step transition and validates the post-login redirect URL.
- Task runner now detects expired sessions (redirect back to sign-in) and reports a clear error.

### Minor change
- Added `slowMo` option to browser launcher in headed mode for better Clerk animation handling.
- Updated `.env` defaults to target AskSam (`https://ai.asksam.com.au`).
- Updated README with Clerk-specific flow documentation, troubleshooting table, and force re-login instructions.

## [1.0.0] - 2026-03-03

### Major change
- Initial project setup with Node.js and Playwright.
- Reusable Chromium browser launcher (`src/utils/browser.js`) with headless mode via environment variable.
- Login script (`src/scripts/login.js`) for form-based authentication with session persistence to `auth.json`.
- Authenticated task runner (`src/scripts/runTask.js`) that loads saved session state, visits a protected page, and takes a full-page screenshot.
- Orchestrator entry point (`src/index.js`) that conditionally runs login before the task.
- Environment configuration (`src/config/env.js`) using dotenv with validation of required variables.
- npm scripts for `start`, `login`, and `task`.
