# Changelog

All notable changes to this project will be documented in this file.

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
