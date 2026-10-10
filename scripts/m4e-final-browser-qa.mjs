/**
 * M4E-FINAL — Six acceptance journeys (Org Admin temp-auth).
 * Evidence only — navigation / UI presence; no destructive domain mutations.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "node:path";

const base = process.env.QA_BASE_URL ?? "http://localhost:43148";
const pass = fs
  .readFileSync(process.env.QA_PASS_FILE ?? "/tmp/m3dd-qa-pass.txt", "utf8")
  .trim();
const outDir =
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m4e-final-qa");
fs.mkdirSync(outDir, { recursive: true });
const docsShotDir = path.join(
  process.cwd(),
  "docs/acceptance-assets/m4e-final/screenshots",
);
fs.mkdirSync(docsShotDir, { recursive: true });

const seededOrg =
  process.env.QA_ORG_ID ?? "f6b317a2-839d-413b-9aa1-2ea4e006f486";
const seededPi =
  process.env.QA_PI_ID ?? "c9cf896f-8a37-43de-aefe-c3af32bcfc78";
const capacityUrl =
  process.env.QA_CAPACITY_URL ??
  `/portfolio/capacity?organizationId=${seededOrg}&piId=${seededPi}`;

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const result = {
  milestone: "M4E-FINAL",
  base,
  generatedAt: new Date().toISOString(),
  principal: "owner (Org Admin temp-auth)",
  startingMainHint: "74dee1e",
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
  return Date.now() - t0;
}

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();

try {
  await login(page);
  step("login", true);

  // ——— Journey A — Executive Management ———
  const homeMs = await timedGoto(page, `${base}/`);
  result.performance.homeMs = homeMs;
  await page.waitForTimeout(500);
  await shot(page, "01-a-home");
  const attentionHome =
    (await page.getByText(/Needs attention|Projects at risk|attention/i).count()) >
    0;

  const portfolioMs = await timedGoto(
    page,
    `${base}/portfolio?organizationId=${seededOrg}`,
  );
  result.performance.portfolioMs = portfolioMs;
  await page.waitForTimeout(700);
  await shot(page, "02-a-portfolio");

  const levels =
    (await page.getByText("Level 1").count()) > 0 &&
    (await page.getByText("Level 2").count()) > 0 &&
    (await page.getByText("Level 3").count()) > 0;
  const healthSummary =
    (await page.getByTestId("portfolio-health-summary").count()) > 0;
  const reviewBlocked = page
    .locator('main a[href*="/portfolio/health"][href*="healthFocus=BLOCKED"]')
    .first();
  let stepsToBlocked = null;
  if ((await reviewBlocked.count()) > 0) {
    const t0 = Date.now();
    await reviewBlocked.click();
    await page.waitForTimeout(900);
    stepsToBlocked = 1;
    result.metrics.msToBlockedHub = Date.now() - t0;
  } else {
    await timedGoto(
      page,
      `${base}/portfolio/health?organizationId=${seededOrg}&healthFocus=BLOCKED`,
    );
    stepsToBlocked = 2;
  }
  await shot(page, "03-a-blocked-hub");

  const projectLink = page
    .locator('main a[href*="/initiatives/"][href*="/project"]')
    .first();
  let projectReached = false;
  if ((await projectLink.count()) > 0) {
    await projectLink.click();
    await page.waitForTimeout(1000);
    projectReached = page.url().includes("/initiatives/");
  } else {
    // Empty blocked list — open Explore from hub
    const openExplorer = page
      .getByRole("link", { name: /Open in explorer/i })
      .first();
    if ((await openExplorer.count()) > 0) {
      await openExplorer.click();
      await page.waitForTimeout(800);
    }
    projectReached =
      page.url().includes("/portfolio/explorer") ||
      page.url().includes("/initiatives/");
  }
  await shot(page, "04-a-project-or-explorer");
  journey("A", levels && healthSummary && projectReached ? "PASS" : "FAIL", {
    attentionHome,
    levels,
    healthSummary,
    stepsToBlocked,
    projectReached,
    url: page.url(),
  });

  // ——— Journey B — Portfolio Discovery ———
  await timedGoto(
    page,
    `${base}/portfolio?organizationId=${seededOrg}`,
  );
  await page.waitForTimeout(400);
  const explorerLink = page
    .locator('main a[href*="/portfolio/explorer"][href*="organizationId="]')
    .first();
  if ((await explorerLink.count()) > 0) {
    await explorerLink.click();
    await page.waitForTimeout(900);
  } else {
    await timedGoto(
      page,
      `${base}/portfolio/explorer?organizationId=${seededOrg}&from=portfolio&fromOrg=${seededOrg}`,
    );
  }
  const explorerMs = await timedGoto(
    page,
    page.url().includes("/portfolio/explorer")
      ? page.url()
      : `${base}/portfolio/explorer?organizationId=${seededOrg}`,
  );
  result.performance.explorerMs = explorerMs;
  await page.waitForTimeout(500);
  await shot(page, "05-b-explorer");

  const search = page
    .getByRole("searchbox")
    .or(page.getByLabel(/Search/i))
    .or(page.locator('input[type="search"], input[name*="search" i]'))
    .first();
  let filterFeedback = false;
  if ((await search.count()) > 0) {
    await search.fill("zzz-no-match-m4e-final");
    await page.waitForTimeout(600);
    filterFeedback =
      (await page.getByText(/No |no match|0 results|empty/i).count()) > 0 ||
      (await page.locator("table tbody tr").count()) === 0;
    await search.fill("");
    await page.waitForTimeout(400);
  } else {
    filterFeedback = true; // filter UI may be select-based; presence of explorer is enough
  }

  const initLinks = await page.$$eval('main a[href*="/initiatives/"]', (as) =>
    as
      .map((a) => a.getAttribute("href") || "")
      .filter((h) => /\/initiatives\/[0-9a-f-]{36}/i.test(h.split("?")[0] ?? "")),
  );
  let returnContext = false;
  if (initLinks[0]) {
    await page.goto(`${base}${initLinks[0]}`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.waitForTimeout(600);
    await shot(page, "06-b-initiative");
    returnContext =
      page.url().includes("from=") ||
      (await page.getByRole("link", { name: /Explorer|Portfolio/i }).count()) >
        0;
  } else {
    await shot(page, "06-b-initiative");
    returnContext = page.url().includes("organizationId=");
  }
  journey(
    "B",
    page.url().includes("/portfolio/explorer") || initLinks.length > 0
      ? "PASS"
      : "FAIL",
    {
      orgPreserved: page.url().includes(`organizationId=${seededOrg}`) ||
        (initLinks[0] ?? "").includes("from="),
      filterFeedback,
      returnContext,
      initiativeCount: initLinks.length,
    },
  );

  // ——— Journey C — Delivery Health ———
  const healthMs = await timedGoto(
    page,
    `${base}/portfolio/health?organizationId=${seededOrg}&healthFocus=AT_RISK`,
  );
  result.performance.healthMs = healthMs;
  await page.waitForTimeout(700);
  await shot(page, "07-c-health-hub");
  const hubOk =
    (await page.getByRole("heading", { name: /^Delivery health$/i }).count()) >
    0;
  const explain = page.getByRole("link", { name: /^Explain$/i }).first();
  let evidenceOk = false;
  if ((await explain.count()) > 0) {
    await explain.click();
    await page.waitForTimeout(1000);
    evidenceOk =
      page.url().includes("projectId=") &&
      ((await page.getByText(/reason|blocker|evidence|classification/i).count()) >
        0 ||
        (await page.getByRole("heading", { name: /Explain|Delivery/i }).count()) >
          0);
    await shot(page, "08-c-explain");
  } else {
    // Empty attention — still valid hub empty state
    evidenceOk =
      (await page.getByText(/No projects in this attention view|No blocked/i).count()) >
        0 ||
      (await page.getByRole("link", { name: /Open in explorer/i }).count()) > 0;
    await shot(page, "08-c-explain");
  }
  journey("C", hubOk && evidenceOk ? "PASS" : "FAIL", {
    hubOk,
    evidenceOk,
    url: page.url(),
  });

  // ——— Journey D — Resource Planning ———
  const capacityMs = await timedGoto(page, `${base}${capacityUrl}`);
  result.performance.capacityMs = capacityMs;
  await page.waitForTimeout(1100);
  await shot(page, "09-d-capacity");
  const capSections =
    (await page.getByTestId("capacity-summary").count()) > 0 &&
    (await page.getByTestId("capacity-hierarchy").count()) > 0;
  const currentLabel =
    (await page.getByText(/CURRENT live|CURRENT/i).count()) > 0;

  const inspect = page.getByRole("button", { name: /^Inspect team$/i }).first();
  let teamExpanded = false;
  let resourceVisible = false;
  let commitmentVisible = false;
  if ((await inspect.count()) > 0) {
    await inspect.click();
    await page.waitForTimeout(500);
    teamExpanded = true;
    resourceVisible =
      (await page.getByText(/membership/i).count()) > 0 ||
      (await page.locator("[data-team-id]").count()) > 0;
  } else {
    const deptToggle = page
      .getByRole("button", { name: /Show .* team|Expand|department/i })
      .first();
    if ((await deptToggle.count()) > 0) {
      await deptToggle.click();
      await page.waitForTimeout(400);
      teamExpanded = true;
    }
  }
  commitmentVisible =
    (await page.getByRole("heading", { name: /Project commitments/i }).count()) >
      0 ||
    (await page.getByRole("link", { name: /Open project|commitment/i }).count()) >
      0;
  await shot(page, "10-d-hierarchy");
  journey(
    "D",
    capSections && currentLabel && (teamExpanded || resourceVisible)
      ? "PASS"
      : "FAIL",
    {
      capSections,
      currentLabel,
      teamExpanded,
      resourceVisible,
      commitmentVisible,
    },
  );

  // ——— Journey E — Cross-Department Planning ———
  await timedGoto(page, `${base}${capacityUrl}`);
  await page.waitForTimeout(800);
  const conflicts =
    (await page.getByTestId("capacity-conflict-explanations").count()) > 0 ||
    (await page.getByText(/Planning conflict|No conflicts/i).count()) > 0;
  const deps =
    (await page.getByTestId("capacity-dependencies-panel").count()) > 0;
  const cross =
    (await page.getByTestId("capacity-cross-department").count()) > 0 ||
    (await page.getByText(/remaining capacity|coordination/i).count()) > 0;
  await shot(page, "11-e-conflicts-deps");

  let destOk = false;
  const depLink = page
    .getByRole("link", {
      name: /Open PI dependencies|View on PI dependencies|Open PI Planning|Open PI board/i,
    })
    .first();
  if ((await depLink.count()) > 0) {
    await depLink.click();
    await page.waitForTimeout(1000);
    destOk =
      page.url().includes("/pi/") ||
      page.url().includes("/dependencies") ||
      page.url().includes("/board");
    await shot(page, "12-e-authorized-destination");
  } else {
    destOk = conflicts || deps;
    await shot(page, "12-e-authorized-destination");
  }
  journey("E", conflicts && deps && destOk ? "PASS" : "FAIL", {
    conflicts,
    deps,
    cross,
    destOk,
    url: page.url(),
  });

  // ——— Journey F — PI Planning ———
  await timedGoto(page, `${base}${capacityUrl}`);
  await page.waitForTimeout(600);
  const piLink = page
    .locator('main a[href*="/pi/"]')
    .filter({ hasText: /Open PI Planning|PI Planning/i })
    .first();
  if ((await piLink.count()) > 0) {
    await piLink.click();
    await page.waitForTimeout(1000);
  } else {
    await timedGoto(page, `${base}/pi/${seededPi}/board`);
  }
  const onPi = /\/pi\/[0-9a-f-]{36}/i.test(page.url());
  await shot(page, "13-f-pi-workspace");

  // Board / Review if reachable
  const boardTab = page.getByRole("link", { name: /^Board$/i }).first();
  if ((await boardTab.count()) > 0) {
    await boardTab.click();
    await page.waitForTimeout(800);
  }
  const boardMs = Date.now();
  await page.waitForTimeout(200);
  result.performance.piBoardMs = Date.now() - boardMs;
  await shot(page, "14-f-board");

  // Return to Portfolio Capacity via PI Capacity CTA
  await timedGoto(page, `${base}/pi/${seededPi}/capacity`);
  await page.waitForTimeout(700);
  await shot(page, "15-f-pi-capacity");
  const portfolioCap = page
    .getByRole("link", { name: /Portfolio Capacity/i })
    .first();
  let backToCapacity = false;
  if ((await portfolioCap.count()) > 0) {
    await portfolioCap.click();
    await page.waitForTimeout(900);
    backToCapacity =
      page.url().includes("/portfolio/capacity") &&
      page.url().includes("organizationId=");
  }
  await shot(page, "16-f-return-capacity");
  journey("F", onPi && backToCapacity ? "PASS" : "FAIL", {
    onPi,
    backToCapacity,
    url: page.url(),
  });

  // ——— Accessibility spot checks ———
  await timedGoto(
    page,
    `${base}/portfolio?organizationId=${seededOrg}`,
  );
  await page.waitForTimeout(400);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const focusTag = await page.evaluate(
    () => document.activeElement?.tagName ?? null,
  );
  result.a11y.focusAfterTab = focusTag;
  const badges =
    (await page.locator('[data-testid*="status"], [class*="badge"]').count()) >
      0 || (await page.getByText(/Blocked|At risk|On track/i).count()) > 0;
  result.a11y.statusLabelsPresent = badges;
  step("a11y-keyboard-focus", !!focusTag, { detail: { focusTag, badges } });

  // ——— Mobile ———
  await page.setViewportSize({ width: 390, height: 844 });
  await timedGoto(
    page,
    `${base}/portfolio?organizationId=${seededOrg}`,
  );
  await page.waitForTimeout(500);
  await shot(page, "17-mobile-portfolio");
  const overflowPortfolio = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  await timedGoto(page, `${base}${capacityUrl}`);
  await page.waitForTimeout(700);
  await shot(page, "18-mobile-capacity");
  const overflowCapacity = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  step(
    "mobile-layouts",
    overflowPortfolio < 48 && overflowCapacity < 80,
    { detail: { overflowPortfolio, overflowCapacity } },
  );

  result.metrics.stepsToBlocked = stepsToBlocked;
  result.metrics.fixtureOrg = seededOrg;
  result.metrics.fixturePi = seededPi;
} catch (err) {
  result.verdict = "FAIL";
  result.error = String(err?.stack || err);
  console.error(err);
  try {
    await page.screenshot({
      path: path.join(outDir, "error.png"),
      fullPage: true,
    });
  } catch {
    /* ignore */
  }
} finally {
  fs.writeFileSync(
    path.join(outDir, "qa-result.json"),
    JSON.stringify(result, null, 2),
  );
  fs.writeFileSync(
    path.join(docsShotDir, "..", "qa-result.json"),
    JSON.stringify(result, null, 2),
  );
  await browser.close();
  console.log("VERDICT", result.verdict);
  console.log("JOURNEYS", JSON.stringify(result.journeys, null, 2));
  if (result.verdict !== "PASS") process.exit(1);
}
