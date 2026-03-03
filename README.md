# User Automation

Production-ready browser automation built with **Node.js** and **Playwright**, designed for applications that use **Clerk OTP authentication**.

Automates the Clerk email + OTP sign-in flow on [AskSam](https://ai.asksam.com.au/), persists session state, and runs authenticated tasks against the dashboard.

---

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9

---

## Installation

```bash
# 1. Install Node.js dependencies
npm install

# 2. Install Playwright's Chromium browser
npx playwright install chromium
```

---

## Configuration

Edit the `.env` file at the project root with your values:

```env
# Browser mode — set to "false" to watch the browser in real time
HEADLESS=true

# Target application (AskSam)
TARGET_URL=https://ai.asksam.com.au/sign-in
PROTECTED_URL=https://ai.asksam.com.au/chat

# Credentials
LOGIN_EMAIL=testautouser00234+clerk_test@tmail.com
OTP_CODE=424242

# Clerk auth selectors (defaults work for AskSam)
SELECTOR_EMAIL=input[name="identifier"]
SELECTOR_CONTINUE=button:has-text("Continue")
SELECTOR_OTP=input[name="code"]

# Post-login URL pattern
AUTH_SUCCESS_URL=https://ai.asksam.com.au/chat

# Output paths
AUTH_STATE_PATH=auth.json
SCREENSHOT_PATH=screenshots/task-result.png

# Timeouts in milliseconds
NAVIGATION_TIMEOUT=30000
STEP_TRANSITION_TIMEOUT=10000
```

### Environment Variables Reference

| Variable                 | Required | Default                       | Description                                         |
| ------------------------ | -------- | ----------------------------- | --------------------------------------------------- |
| `HEADLESS`               | No       | `true`                        | Run browser without visible UI                      |
| `TARGET_URL`             | Yes      | —                             | Clerk sign-in page URL                              |
| `PROTECTED_URL`          | Yes      | —                             | Authenticated page to visit after login             |
| `LOGIN_EMAIL`            | Yes      | —                             | Email for Clerk sign-in                             |
| `OTP_CODE`               | Yes      | —                             | OTP verification code                               |
| `SELECTOR_EMAIL`         | No       | `input[name="identifier"]`    | CSS selector for Clerk email input                  |
| `SELECTOR_CONTINUE`      | No       | `button:has-text("Continue")` | Selector for the Continue button (both steps)       |
| `SELECTOR_OTP`           | No       | `input[name="code"]`          | CSS selector for the OTP code input                 |
| `AUTH_SUCCESS_URL`       | No       | `…/chat`                      | URL prefix that indicates successful authentication |
| `AUTH_STATE_PATH`        | No       | `auth.json`                   | Path to save/load browser session state             |
| `SCREENSHOT_PATH`        | No       | `screenshots/task-result.png` | Path for the task screenshot                        |
| `NAVIGATION_TIMEOUT`     | No       | `30000`                       | Max wait for page navigation (ms)                   |
| `STEP_TRANSITION_TIMEOUT`| No       | `10000`                       | Max wait for Clerk step transitions (ms)            |

---

## How Clerk OTP Login Works

Clerk uses a **multi-step** sign-in flow with email verification:

1. **Step 1** (`/sign-in`) — The sign-in page shows an email input and a "Continue" button. The script fills the email and clicks Continue.
2. **Step 2** (`/sign-in/factor-one`) — Clerk sends an OTP code and shows a verification input. The script fills the 6-digit code. Clerk **auto-submits** once all digits are entered.
3. **Step 3** — After successful verification, Clerk redirects to `/chat`. The script saves all cookies and storage to `auth.json`.

On subsequent runs, the saved session is loaded directly — no re-login needed until the session expires.

---

## Usage

### Full flow (login if needed, then run task)

```bash
npm start
```

Checks for `auth.json`. If missing, runs the Clerk OTP login flow first, then executes the task.

### Login only

```bash
npm run login
```

Runs the email + OTP sign-in and saves session state to `auth.json`.

### Task only (requires prior login)

```bash
npm run task
```

Loads the saved session, opens the protected page, and takes a full-page screenshot. If the session expired and the site redirects to sign-in, the script reports the error.

### Force re-login

Delete the saved session and start fresh:

```bash
# Windows
del auth.json && npm start

# macOS / Linux
rm auth.json && npm start
```

---

## Project Structure

```
user-automation/
├── src/
│   ├── config/
│   │   └── env.js          # Loads and validates environment variables
│   ├── scripts/
│   │   ├── login.js        # Clerk OTP login flow (email → code → redirect)
│   │   └── runTask.js      # Authenticated task — screenshot protected page
│   ├── utils/
│   │   └── browser.js      # Reusable Chromium launcher
│   └── index.js            # Orchestrator entry point
├── .env                    # Environment variables (not committed)
├── .gitignore
├── CHANGELOG.md
├── package.json
└── README.md
```

---

## Troubleshooting

| Problem | Solution |
| --- | --- |
| Browser fails to launch | Run `npx playwright install chromium` |
| "Couldn't find your account" | Verify `LOGIN_EMAIL` is a registered AskSam account |
| OTP input never appears | Increase `STEP_TRANSITION_TIMEOUT` or check `SELECTOR_OTP` |
| OTP auto-submit doesn't work | The script falls back to clicking "Continue" automatically |
| Session expired | Delete `auth.json` and run `npm start` |
| Want to watch the browser | Set `HEADLESS=false` in `.env` |

---

## License

ISC
