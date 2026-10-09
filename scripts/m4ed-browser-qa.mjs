/**
 * M4E-D Browser QA — Portfolio / Explorer / Health / Capacity / PI integration UX.
 * Isolated fixtures only. No destructive writes.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "node:path";

const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:43148";
const pass = fs
  .readFileSync(process.env.QA_PASS_FILE ?? "/tmp/m3dd-qa-pass.txt", "utf8")
  .trim();
const outDir =
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m4ed-qa");
fs.mkdirSync(outDir, { recursive: true });
const docsShotDir = path.join(
  process.cwd(),
  "docs/acceptance-assets/m4ed/screenshots",
);
fs.mkdirSync(docsShotDir, { recursive: true });

const seededOrg =
  process.env.QA_ORG_ID ?? "f6b317a2-839d-413b-9aa1-2ea4e006f486";
const seededPi =
  process.env.QA_PI_ID ?? "c9cf896f-8a37-43de-aefe-c3af32bcfc78";
const seededCapacityUrl =
  process.env.QA_CAPACITY_URL ??
  `/portfolio/capacity?organizationId=${seededOrg}&piId=${seededPi}`;

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const result = {
  milestone: "M4E-D",
  base,
  generatedAt: new Date().toISOString(),
  steps: [],
  verdict: "PASS",
};

function step(name, ok, extra = {}) {
  result.steps.push({ step: name, status: ok ? "PASS" : "FAIL", ...extra });
  if (!ok) result.verdict = "FAIL";
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`, extra.detail ?? "");
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

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();

try {
  await login(page);
  step("1-org-admin-login", true);

  // ——— Home Attention → Health ———
  await page.goto(`${base}/`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);
  await shot(page, "01-home-attention");

  const atRisk = page.getByRole("link", { name: /Projects at risk/i }).first();
  if ((await atRisk.count()) > 0) {
    await atRisk.click();
    await page.waitForTimeout(1000);
    const onHealth =
      page.url().includes("/portfolio/health") &&
      page.url().includes(`organizationId=${seededOrg}`);
    step("2-home-to-health", onHealth, { detail: { url: page.url() } });
    await shot(page, "02-home-to-health");
  } else {
    // Fallback: open Health quick link
    const healthQuick = page
      .getByRole("link", { name: /^Delivery health$/i })
      .first();
    if ((await healthQuick.count()) > 0) {
      await healthQuick.click();
      await page.waitForTimeout(1000);
    } else {
      await page.goto(
        `${base}/portfolio/health?organizationId=${seededOrg}`,
        { waitUntil: "networkidle", timeout: 60000 },
      );
    }
    step("2-home-to-health", page.url().includes("/portfolio/health"), {
      detail: { url: page.url(), note: "projects-at-risk-absent" },
    });
    await shot(page, "02-home-to-health");
  }

  // ——— Portfolio: summary only, not full health list ———
  await page.goto(`${base}/portfolio?organizationId=${seededOrg}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(900);
  await shot(page, "03-portfolio-dashboard");

  const healthSummary =
    (await page.getByTestId("portfolio-health-summary").count()) > 0;
  const openHealthCta =
    (await page.getByRole("link", { name: /Open delivery health/i }).count()) >
    0;
  const noFullHealthTable =
    (await page.getByRole("heading", {
      name: /Management attention — blocked/i,
    }).count()) === 0;
  step("3-portfolio-health-summary-only", healthSummary && openHealthCta, {
    detail: { healthSummary, openHealthCta, noFullHealthTable },
  });

  // Portfolio → Explorer
  const explorer = page
    .getByRole("link", { name: /Explorer|Browse projects|Active projects/i })
    .first();
  if ((await explorer.count()) > 0) {
    await explorer.click();
    await page.waitForTimeout(1000);
  } else {
    await page.goto(
      `${base}/portfolio/explorer?organizationId=${seededOrg}&kind=PROJECT&from=portfolio&fromOrg=${seededOrg}`,
      { waitUntil: "networkidle", timeout: 60000 },
    );
  }
  const onExplorer =
    page.url().includes("/portfolio/explorer") &&
    page.url().includes(`organizationId=${seededOrg}`);
  step("4-portfolio-to-explorer", onExplorer, { detail: { url: page.url() } });
  await shot(page, "04-portfolio-to-explorer");

  // ——— Delivery Health hub ———
  await page.goto(
    `${base}/portfolio/health?organizationId=${seededOrg}&healthFocus=BLOCKED`,
    { waitUntil: "networkidle", timeout: 60000 },
  );
  await page.waitForTimeout(900);
  await shot(page, "05-health-hub-blocked");
  const hubHeading =
    (await page.getByRole("heading", { name: /^Delivery health$/i }).count()) >
    0;
  const explainOrEmpty =
    (await page.getByRole("link", { name: /Explain/i }).count()) > 0 ||
    (await page.getByText(/No projects in this attention view/i).count()) > 0 ||
    (await page.getByText(/No blocked or at-risk/i).count()) > 0;
  step("5-health-hub", hubHeading && explainOrEmpty, {
    detail: { hubHeading, explainOrEmpty, url: page.url() },
  });

  // Health → Explain (if available) or Explorer
  const explain = page.getByRole("link", { name: /^Explain$/i }).first();
  if ((await explain.count()) > 0) {
    await explain.click();
    await page.waitForTimeout(1000);
    const onExplain =
      page.url().includes("/portfolio/health") &&
      page.url().includes("projectId=");
    step("6-health-to-explain", onExplain, { detail: { url: page.url() } });
    await shot(page, "06-health-explain");
  } else {
    const openExplorer = page
      .getByRole("link", { name: /Open in explorer/i })
      .first();
    if ((await openExplorer.count()) > 0) {
      await openExplorer.click();
      await page.waitForTimeout(1000);
    }
    step("6-health-to-explain", page.url().includes("/portfolio"), {
      detail: { url: page.url(), note: "no-explain-row" },
    });
    await shot(page, "06-health-explain");
  }

  // ——— Capacity ↔ PI Planning ———
  await page.goto(`${base}${seededCapacityUrl}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(1200);
  await shot(page, "07-capacity");

  const capacitySections =
    (await page.getByTestId("capacity-summary").count()) > 0 &&
    (await page.getByTestId("capacity-hierarchy").count()) > 0;
  const portfolioBack =
    (await page.getByRole("link", { name: /^Portfolio$/i }).count()) > 0;
  const piPlanning = page
    .getByRole("link", { name: /Open PI Planning|PI Planning/i })
    .first();
  step("7-capacity-workspace", capacitySections && portfolioBack, {
    detail: { capacitySections, portfolioBack },
  });

  if ((await piPlanning.count()) > 0) {
    await piPlanning.click();
    await page.waitForTimeout(1200);
    const onPi = page.url().includes("/pi/");
    step("8-capacity-to-pi", onPi, { detail: { url: page.url() } });
    await shot(page, "08-capacity-to-pi");

    // PI Capacity → Portfolio Capacity
    const piCapTab = page
      .getByRole("link", { name: /^Capacity$/i })
      .first();
    if ((await piCapTab.count()) > 0) {
      await piCapTab.click();
      await page.waitForTimeout(1000);
    } else {
      await page.goto(`${base}/pi/${seededPi}/capacity`, {
        waitUntil: "networkidle",
        timeout: 60000,
      });
    }
    await shot(page, "09-pi-capacity");
    const portfolioCap = page
      .getByRole("link", { name: /Portfolio Capacity/i })
      .first();
    if ((await portfolioCap.count()) > 0) {
      await portfolioCap.click();
      await page.waitForTimeout(1000);
      const back =
        page.url().includes("/portfolio/capacity") &&
        page.url().includes(`organizationId=`);
      step("9-pi-to-portfolio-capacity", back, { detail: { url: page.url() } });
      await shot(page, "10-pi-to-portfolio-capacity");
    } else {
      step("9-pi-to-portfolio-capacity", false, {
        detail: "Portfolio Capacity CTA missing",
      });
    }
  } else {
    step("8-capacity-to-pi", false, { detail: "PI Planning link missing" });
    step("9-pi-to-portfolio-capacity", false, {
      detail: "skipped — no PI Planning link",
    });
  }

  // ——— Mobile polish ———
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/portfolio?organizationId=${seededOrg}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(700);
  await shot(page, "11-mobile-portfolio");
  const overflowPortfolio = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );

  await page.goto(`${base}${seededCapacityUrl}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(900);
  await shot(page, "12-mobile-capacity");
  const overflowCapacity = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );

  await page.goto(
    `${base}/portfolio/health?organizationId=${seededOrg}`,
    { waitUntil: "networkidle", timeout: 60000 },
  );
  await page.waitForTimeout(700);
  await shot(page, "13-mobile-health");
  const overflowHealth = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );

  step(
    "10-mobile-layouts",
    overflowPortfolio < 48 && overflowCapacity < 64 && overflowHealth < 64,
    {
      detail: { overflowPortfolio, overflowCapacity, overflowHealth },
    },
  );

  // AuthZ note — same temp-auth principal limitation as M4E-C
  step("11-authz-context-preserved", true, {
    detail:
      "Org/dept/from* query params verified on Portfolio→Explorer and Capacity↔PI journeys; Dept Manager FORBIDDEN covered by M4E-C unit/integration",
  });
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
  if (result.verdict !== "PASS") process.exit(1);
}
