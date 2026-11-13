import path from "path";
import fs from "fs";
import { chromium, BrowserContext, Browser } from "playwright";
import prisma from "../lib/db";
import { decryptTargetPassword } from "../lib/crypto";

export interface BotRunResult {
  userId: string;
  username: string;
  success: boolean;
  message: string;
  durationMs: number;
  executedAt: Date;
}

const activeUserLocks = new Set<string>();

export function getUserSessionDir(userId: string): string {
  const baseDir =
    process.env.USER_DATA_BASE_DIR ||
    path.join(process.cwd(), ".playwright-sessions");
  const userDir = path.resolve(baseDir, `user_${userId}`);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  return userDir;
}

export function removeUserSessionDir(userId: string): void {
  const baseDir =
    process.env.USER_DATA_BASE_DIR ||
    path.join(process.cwd(), ".playwright-sessions");
  const userDir = path.resolve(baseDir, `user_${userId}`);
  if (fs.existsSync(userDir)) {
    fs.rmSync(userDir, { recursive: true, force: true });
  }
}

/**
 * Runs the daily automated routine for an XPR3T account:
 * 1. Launches Chromium with robust Linux sandbox flags.
 * 2. Navigates to Dashboard or Sign-in.
 * 3. Handles login with exact credential checks.
 * 4. Checks Arbitrage Engine status ("Start Now" vs "View Trade").
 * 5. Logs accurate message without falsely reporting wrong credentials.
 */
export async function runBotForUser(userId: string): Promise<BotRunResult> {
  const startTime = Date.now();
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new Error(`User with ID "${userId}" not found.`);
  }

  if (activeUserLocks.has(userId)) {
    return {
      userId,
      username: user.username,
      success: false,
      message: "A bot session is already running for this user.",
      durationMs: Date.now() - startTime,
      executedAt: new Date(),
    };
  }

  activeUserLocks.add(userId);
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  await prisma.user.update({
    where: { id: userId },
    data: {
      lastRunStatus: "running",
      lastRunMessage: "Opening browser & checking XPR3T Dashboard...",
    },
  });

  try {
    const userDataDir = getUserSessionDir(user.id);
    const isHeadless = process.env.PLAYWRIGHT_HEADLESS !== "false";

    // Launch persistent context with explicit Linux-safe flags
    try {
      context = await chromium.launchPersistentContext(userDataDir, {
        headless: isHeadless,
        viewport: { width: 1280, height: 800 },
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-zygote",
          "--single-process",
          "--disable-blink-features=AutomationControlled",
        ],
      });
    } catch {
      // Fallback: If launchPersistentContext fails on some Linux setups, launch standard browser
      browser = await chromium.launch({
        headless: isHeadless,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      });
      context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      });
    }

    const page =
      context.pages().length > 0 ? context.pages()[0] : await context.newPage();

    console.log(`[Bot][${user.username}] Navigating to Dashboard / Sign-in...`);
    await page.goto("https://xpr3t.com/Jmd810vPa67mEL/Dashboard.html", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForTimeout(2000);

    // If redirected to Sign-in.html or login form is present, perform automated login
    const isLoginPage =
      page.url().includes("Sign-in.html") ||
      (await page.locator("#inputEmail").isVisible({ timeout: 2000 }).catch(() => false));

    if (isLoginPage) {
      console.log(`[Bot][${user.username}] Login required. Filling credentials...`);

      const plainPassword = decryptTargetPassword(user.encryptedPassword);
      if (!plainPassword) {
        throw new Error("Target site password could not be decrypted.");
      }

      const usernameInput = page.locator("#inputEmail").first();
      const passwordInput = page.locator("#inputPassword").first();
      const submitButton = page.locator("#submit-login").first();

      await usernameInput.fill("");
      await usernameInput.fill(user.username);
      await passwordInput.fill("");
      await passwordInput.fill(plainPassword);

      const rememberCheckbox = page.locator("input[name='remember']").first();
      if (await rememberCheckbox.isVisible({ timeout: 1000 }).catch(() => false)) {
        await rememberCheckbox.check().catch(() => {});
      }

      await submitButton.click();

      // Wait for login redirection or SweetAlert popup
      await Promise.race([
        page.waitForURL((url) => !url.href.includes("Sign-in.html"), { timeout: 15000 }),
        page.locator(".sweet-alert.showSweetAlert, .sweet-alert.visible").waitFor({ state: "visible", timeout: 8000 }),
      ]).catch(() => {});

      await page.waitForTimeout(2000);

      // Check for incorrect credentials alert
      const swalAlert = page.locator(".sweet-alert.showSweetAlert p, .sweet-alert.visible p").first();
      if (await swalAlert.isVisible({ timeout: 1000 }).catch(() => false)) {
        const errorText = (await swalAlert.textContent())?.trim() || "";
        if (
          page.url().includes("Sign-in.html") ||
          errorText.toLowerCase().includes("invalid") ||
          errorText.toLowerCase().includes("sorry") ||
          errorText.toLowerCase().includes("not match") ||
          errorText.toLowerCase().includes("incorrect")
        ) {
          throw new Error(`Wrong username or password (${errorText || "Invalid credentials"})`);
        }
      }

      // If still on Sign-in.html after clicking submit
      if (page.url().includes("Sign-in.html")) {
        throw new Error("Wrong username or password (Login failed).");
      }
    }

    // Dismiss any announcement / news modal on Dashboard
    const modalClose = page.locator(".cfx-modal-close, button.confirm").first();
    if (await modalClose.isVisible({ timeout: 2000 }).catch(() => false)) {
      await modalClose.click().catch(() => {});
    }

    // Wait for Arbitrage Engine check to complete on Dashboard
    console.log(`[Bot][${user.username}] Checking Arbitrage Engine button...`);
    await page.waitForTimeout(2500);

    const arbitrageBtn = page.locator("#btnArbitrageStart");
    let btnText = "";

    try {
      await arbitrageBtn.waitFor({ state: "visible", timeout: 10000 });
      btnText = (await arbitrageBtn.textContent())?.trim() || "";
    } catch {
      console.log(`[Bot][${user.username}] Button wait timeout, reading text...`);
      btnText = (await arbitrageBtn.textContent().catch(() => ""))?.trim() || "";
    }

    console.log(`[Bot][${user.username}] Current Arbitrage button text: "${btnText}"`);

    let finalMessage = "";

    if (btnText.toLowerCase().includes("start")) {
      // Need to click Start Engine!
      console.log(`[Bot][${user.username}] "Start Now" detected! Clicking Arbitrage Start Engine button...`);
      await arbitrageBtn.click();
      await page.waitForTimeout(3000);

      const durationMs = Date.now() - startTime;
      finalMessage = `Clicked Start Engine successfully! Daily trade activated. (${durationMs}ms)`;
    } else if (btnText.toLowerCase().includes("view trade")) {
      // Already active
      console.log(`[Bot][${user.username}] "View Trade" detected! Already started for today.`);
      const durationMs = Date.now() - startTime;
      finalMessage = `Engine already active for today (View Trade). (${durationMs}ms)`;
    } else {
      const card = page.locator("#arbitrageEngineCard");
      if (await card.isVisible({ timeout: 2000 }).catch(() => false)) {
        await card.click().catch(() => {});
      }
      const durationMs = Date.now() - startTime;
      finalMessage = `Dashboard loaded: Engine status "${btnText || 'Active'}" (${durationMs}ms)`;
    }

    const durationMs = Date.now() - startTime;
    const executedAt = new Date();

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          lastRunAt: executedAt,
          lastRunStatus: "success",
          lastRunMessage: finalMessage,
        },
      }),
      prisma.runLog.create({
        data: {
          userId: user.id,
          status: "success",
          message: finalMessage,
          durationMs,
          executedAt,
        },
      }),
    ]);

    console.log(`[Bot][${user.username}] SUCCESS: ${finalMessage}`);

    return {
      userId: user.id,
      username: user.username,
      success: true,
      message: finalMessage,
      durationMs,
      executedAt,
    };
  } catch (error: unknown) {
    const durationMs = Date.now() - startTime;
    const executedAt = new Date();
    const rawErrorMessage =
      error instanceof Error ? error.message : "Unknown Playwright error";

    // ONLY report "Wrong username or password" if actual login authentication failed
    let displayError = rawErrorMessage;
    if (rawErrorMessage.startsWith("Wrong username or password")) {
      displayError = "Wrong username or password";
    }

    console.error(`[Bot][${user.username}] FAILED: ${displayError}`);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          lastRunAt: executedAt,
          lastRunStatus: "failed",
          lastRunMessage: displayError,
        },
      }),
      prisma.runLog.create({
        data: {
          userId: user.id,
          status: "failed",
          message: displayError,
          durationMs,
          executedAt,
        },
      }),
    ]);

    return {
      userId: user.id,
      username: user.username,
      success: false,
      message: displayError,
      durationMs,
      executedAt,
    };
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
    activeUserLocks.delete(userId);
  }
}

export async function runAllActiveUsers(): Promise<BotRunResult[]> {
  const activeUsers = await prisma.user.findMany({
    where: { status: "active" },
    orderBy: { createdAt: "asc" },
  });

  console.log(`[Worker] Running daily Arbitrage Engine bot for ${activeUsers.length} user(s)...`);

  const results: BotRunResult[] = [];
  for (const user of activeUsers) {
    const result = await runBotForUser(user.id);
    results.push(result);
  }
  return results;
}

function getMsUntilNextMidnightIST(): number {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const nowIst = new Date(now.getTime() + istOffsetMs);

  const nextRunIst = new Date(nowIst);
  nextRunIst.setUTCDate(nextRunIst.getUTCDate() + 1);
  nextRunIst.setUTCHours(0, 1, 0, 0);

  const msUntilRun = nextRunIst.getTime() - nowIst.getTime();
  return Math.max(msUntilRun, 1000);
}

export async function startDailyMidnightScheduler(): Promise<void> {
  console.log("[Scheduler] Initializing 12:00 AM Midnight IST Daily Auto-Click Scheduler...");

  async function scheduleNext() {
    const msUntilMidnight = getMsUntilNextMidnightIST();
    const hours = (msUntilMidnight / (1000 * 60 * 60)).toFixed(2);
    console.log(
      `[Scheduler] Next daily click run scheduled at 12:01 AM IST (in ${hours} hours / ${Math.round(msUntilMidnight / 1000)} seconds).`
    );

    setTimeout(async () => {
      try {
        console.log(`[Scheduler] 12:01 AM IST Triggered! Running all active accounts...`);
        await runAllActiveUsers();
      } catch (err) {
        console.error("[Scheduler] Error during midnight run:", err);
      } finally {
        scheduleNext();
      }
    }, msUntilMidnight);
  }

  scheduleNext();
}

const isMainModule =
  typeof require !== "undefined" && require.main === module
    ? true
    : process.argv[1]?.replace(/\\/g, "/").endsWith("workers/bot.ts");

if (isMainModule) {
  const runOnce = process.argv.includes("--once");
  if (runOnce) {
    runAllActiveUsers()
      .then(() => {
        console.log("[Worker] Single execution complete.");
        process.exit(0);
      })
      .catch((err) => {
        console.error("[Worker] Fatal error:", err);
        process.exit(1);
      });
  } else {
    runAllActiveUsers().finally(() => {
      startDailyMidnightScheduler().catch((err) => {
        console.error("[Worker] Fatal error starting scheduler:", err);
        process.exit(1);
      });
    });
  }
}
