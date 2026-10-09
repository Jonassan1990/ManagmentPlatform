/**
 * M4D-FINAL — End-to-end journey verification (Org Admin temp-auth).
 * Documentation evidence only — does not mutate domain state beyond navigation.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "node:path";

const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:43148";
const pass = fs
  .readFileSync(process.env.QA_PASS_FILE ?? "/tmp/m3dd-qa-pass.txt", "utf8")
  .trim();
const outDir =
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m4d-final-qa");
fs.mkdirSync(outDir, { recursive: true });
const docsShotDir = path.join(
  process.cwd(),
  "docs/acceptance-assets/m4d-final/screenshots",
);
fs.mkdirSync(docsShotDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const result = {
  milestone: "M4D-FINAL",
  base,
  generatedAt: new Date().toISOString(),
  principal: "owner (Org Admin temp-auth)",
  journeys: {},
  performance: {},
  a11y: {},
  metrics: {},
  steps: [],
  verdict: "PASS",
};

function step(name, ok, extra = {}) {
  result.steps.push({ step: name, status: ok ? "PASS" : "FAIL", ...extra });
  if (!ok) result.verdict = "FAIL";
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`, extra.detail ?? "");
}

function journey(id, status, detail = {}) {
  result.journeys[id] = { status, ...detail };
  step(`journey-${id}`, status === "PASS" || status === "PARTIAL", {
    detail: { status, ...detail },
  });
}

async function login(page) {
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="username"]', "owner");
  await page.fill('input[name="password"]', pass);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 25000,
    }),
    page.getByRole("button", { name: /Sign in/i }).click(),
  ]);
}

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  fs.copyFileSync(file, path.join(docsShotDir, `${name}.png`));
  return file;
}

async function timedGoto(page, url) {
  const t0 = Date.now();
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  const ms = Date.now() - t0;
  return ms;
}

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();

try {
  await login(page);
  step("login", true);

  // ——— Journey C: Management (Home → Portfolio → Explorer → Initiative/Project → Health)
  const homeMs = await timedGoto(page, `${base}/`);
  result.performance.homeMs = homeMs;
  await page.waitForTimeout(400);
  const needsAttention =
    (await page.getByRole("heading", { name: /Needs attention/i }).count()) > 0;
  await shot(page, "01-journey-c-home");

  const portfolioMs = await timedGoto(
    page,
    `${base}/portfolio`,
  );
  result.performance.portfolioMs = portfolioMs;
  await page.waitForTimeout(400);
  await shot(page, "02-journey-c-portfolio");

  await timedGoto(page, `${base}/portfolio/explorer`);
  await page.waitForTimeout(500);
  const explorerRows = await page.$$eval('a[href*="/initiatives/"]', (as) =>
    as
      .map((a) => a.getAttribute("href") || "")
      .filter((h) => /\/initiatives\/[0-9a-f-]{36}/i.test(h.split("?")[0] ?? "")),
  );
  await shot(page, "03-journey-c-explorer");
  let initiativePath = explorerRows[0] ?? null;
  let healthOk = false;
  if (initiativePath) {
    await page.goto(`${base}${initiativePath}`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.waitForTimeout(500);
    const groups =
      (await page.getByRole("navigation", { name: "Initiative sections" }).count()) >
      0;
    const lifecycle =
      (await page.getByLabel("Initiative lifecycle").count()) > 0 ||
      (await page.getByText(/Required next action/i).count()) > 0;
    await shot(page, "04-journey-c-initiative");
    await timedGoto(
      page,
      `${base}/portfolio/health`,
    );
    await page.waitForTimeout(400);
    healthOk =
      (await page.getByRole("heading", { name: /Delivery health|health/i }).count()) >
        0 || page.url().includes("/portfolio/health");
    await shot(page, "05-journey-c-health");
    journey("C", needsAttention && groups && lifecycle && healthOk ? "PASS" : "PARTIAL", {
      needsAttention,
      groups,
      lifecycle,
      healthOk,
      initiativePath,
    });
  } else {
    journey("C", "PARTIAL", { detail: "No explorer initiative fixture" });
  }

  // ——— Journey A: Initiative workspace chrome (stage progression via UI presence)
  if (initiativePath) {
    const baseInit = initiativePath.split("?")[0].replace(/\/(project|demand|requirements|pre-study|governance|poc|pilot).*$/, "");
    // reopen overview
    await timedGoto(page, `${base}${baseInit}`);
    await page.waitForTimeout(500);
    const discovery =
      (await page.getByText("Discovery", { exact: true }).count()) > 0;
    const nextAction =
      (await page.getByText(/Required next action|Act on next step/i).count()) >
      0;
    // Visit governance if visible
    const gov = page
      .getByRole("navigation", { name: "Initiative sections" })
      .getByRole("link", { name: "Governance" });
    let govOk = true;
    if ((await gov.count()) > 0) {
      const gh = await gov.getAttribute("href");
      await page.goto(`${base}${gh}`, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(400);
      govOk =
        (await page.getByText(/evidence|approval|decision|does not auto-create/i).count()) >
        0;
      await shot(page, "06-journey-a-governance");
    }
    // Project tab if present
    const proj = page
      .getByRole("navigation", { name: "Initiative sections" })
      .getByRole("link", { name: "Project" });
    let projectOk = true;
    if ((await proj.count()) > 0) {
      const ph = await proj.getAttribute("href");
      await page.goto(`${base}${ph}`, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(500);
      projectOk =
        (await page.getByText(/Issues|Milestones|Closure|More sections|No Project yet/i).count()) >
        0;
      await shot(page, "07-journey-a-project");
    }
    // Count visible tab links in nav
    const tabCount = await page
      .getByRole("navigation", { name: "Initiative sections" })
      .getByRole("link")
      .count();
    result.metrics.initiativeTabLinksVisible = tabCount;
    result.metrics.initiativeGroupedNav = discovery;
    journey(
      "A",
      discovery && nextAction && govOk && projectOk ? "PASS" : "PARTIAL",
      { discovery, nextAction, govOk, projectOk, tabCount },
    );
  } else {
    journey("A", "PARTIAL", { detail: "No initiative fixture" });
  }

  // ——— Journey E: Governance (Approvals / Decisions hubs + initiative gate)
  await timedGoto(page, `${base}/approvals`);
  await page.waitForTimeout(400);
  const approvalsOk =
    (await page.getByRole("heading", { name: /Approval/i }).count()) > 0 ||
    page.url().includes("/approvals");
  await shot(page, "08-journey-e-approvals");
  await timedGoto(page, `${base}/decisions`);
  await page.waitForTimeout(400);
  const decisionsOk =
    (await page.getByRole("heading", { name: /Decision/i }).count()) > 0 ||
    page.url().includes("/decisions");
  await shot(page, "09-journey-e-decisions");
  journey("E", approvalsOk && decisionsOk ? "PASS" : "PARTIAL", {
    approvalsOk,
    decisionsOk,
  });

  // ——— Journey B: PI Planning Board → Compare → Review
  await timedGoto(page, `${base}/pi`);
  await page.waitForTimeout(400);
  const piHrefs = await page.$$eval('a[href^="/pi/"]', (as) =>
    as
      .map((a) => a.getAttribute("href") || "")
      .filter((h) => /^\/pi\/[0-9a-f-]{36}/i.test(h.split("?")[0] ?? "")),
  );
  if (piHrefs[0]) {
    const piBase = piHrefs[0].split("?")[0];
    const boardMs = await timedGoto(page, `${base}${piBase}/board`);
    result.performance.boardMs = boardMs;
    await page.waitForTimeout(600);
    const contextStrip =
      (await page.getByLabel(/Planning context/i).count()) > 0 ||
      (await page.getByText(/Planning context/i).count()) > 0;
    const manage =
      (await page.getByRole("button", {
        name: /Create, clone, rename, archive|Manage scenarios|Hide create/i,
      }).count()) > 0;
    await shot(page, "10-journey-b-board");

    const compareMs = await timedGoto(page, `${base}${piBase}/compare`);
    result.performance.compareMs = compareMs;
    await page.waitForTimeout(500);
    await shot(page, "11-journey-b-compare");

    const reviewMs = await timedGoto(page, `${base}${piBase}/review`);
    result.performance.reviewMs = reviewMs;
    await page.waitForTimeout(600);
    const workflowBar =
      (await page.getByText(/Plan|Compare|Select|Promote|Approve|Baseline/i).count()) >
      0;
    const nextCard =
      (await page.getByText(/Next action|primary/i).count()) > 0 ||
      (await page.getByRole("heading", { name: /Next/i }).count()) > 0;
    await shot(page, "12-journey-b-review");

    // Keyboard: Tab into PI sections
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const activeTag = await page.evaluate(() => document.activeElement?.tagName);
    result.a11y.keyboardFocusTag = activeTag;

    journey(
      "B",
      contextStrip && manage && workflowBar ? "PASS" : "PARTIAL",
      { contextStrip, manage, workflowBar, nextCard, boardMs, compareMs, reviewMs },
    );
  } else {
    journey("B", "FAIL", { detail: "No PI fixture" });
  }

  // ——— Journey D: Portfolio Capacity → PI
  await timedGoto(page, `${base}/portfolio/capacity`);
  await page.waitForTimeout(600);
  const capacityPage = page.url().includes("/portfolio/capacity");
  const openPi =
    (await page.getByRole("link", { name: /Open PI|Planning board|PI Planning|Open/i }).count()) >
      0 ||
    (await page.locator('a[href^="/pi/"]').count()) > 0;
  await shot(page, "13-journey-d-capacity");
  let capacityToPi = false;
  const capPi = await page.$$eval('a[href^="/pi/"]', (as) =>
    as.map((a) => a.getAttribute("href") || "").filter(Boolean),
  );
  if (capPi[0]) {
    await page.goto(`${base}${capPi[0]}`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.waitForTimeout(400);
    capacityToPi = page.url().includes("/pi/");
    await shot(page, "14-journey-d-pi-from-capacity");
  }
  journey(
    "D",
    capacityPage && (openPi || capacityToPi) ? "PASS" : "PARTIAL",
    { capacityPage, openPi, capacityToPi, note: "Progressive PI default still M4E (UX-006)" },
  );

  // ——— Mobile smoke
  await page.setViewportSize({ width: 390, height: 844 });
  await timedGoto(page, `${base}/`);
  await page.waitForTimeout(400);
  const mobileHome =
    (await page.getByRole("heading", { name: /Needs attention/i }).count()) > 0;
  await shot(page, "15-mobile-home");
  if (piHrefs[0]) {
    const piBase = piHrefs[0].split("?")[0];
    await timedGoto(page, `${base}${piBase}/review`);
    await page.waitForTimeout(500);
    await shot(page, "16-mobile-review");
  }
  result.a11y.mobileHome = mobileHome;
  step("mobile-smoke", mobileHome, {});

  // Metrics summary from DOM counts on board (desktop reopen)
  await page.setViewportSize({ width: 1440, height: 900 });
  if (piHrefs[0]) {
    const piBase = piHrefs[0].split("?")[0];
    await timedGoto(page, `${base}${piBase}/board`);
    await page.waitForTimeout(500);
    const manageOpen = page.getByRole("button", {
      name: /Create, clone, rename, archive/i,
    });
    result.metrics.scenarioAdminCollapsedDefault =
      (await manageOpen.count()) > 0;
  }
} catch (e) {
  step("fatal", false, { detail: String(e) });
  try {
    await shot(page, "error");
  } catch {
    /* ignore */
  }
} finally {
  const statuses = Object.values(result.journeys).map((j) => j.status);
  if (statuses.includes("FAIL") || result.verdict === "FAIL") {
    result.verdict = "FAIL";
  } else if (statuses.includes("PARTIAL")) {
    result.verdict = "PARTIAL";
  } else {
    result.verdict = "PASS";
  }
  fs.writeFileSync(
    path.join(outDir, "qa-result.json"),
    JSON.stringify(result, null, 2),
  );
  await browser.close();
  console.log(JSON.stringify({ verdict: result.verdict, journeys: result.journeys, performance: result.performance }, null, 2));
  process.exit(result.verdict === "FAIL" ? 1 : 0);
}
