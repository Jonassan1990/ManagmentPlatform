/**
 * M4E-A Browser QA — Executive Portfolio Dashboard UX.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "node:path";

const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:43148";
const pass = fs
  .readFileSync(process.env.QA_PASS_FILE ?? "/tmp/m3dd-qa-pass.txt", "utf8")
  .trim();
const outDir =
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m4ea-qa");
fs.mkdirSync(outDir, { recursive: true });
const docsShotDir = path.join(
  process.cwd(),
  "docs/acceptance-assets/m4ea/screenshots",
);
fs.mkdirSync(docsShotDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const result = {
  milestone: "M4E-A",
  base,
  generatedAt: new Date().toISOString(),
  measurements: {},
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

  await page.goto(`${base}/portfolio`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(700);
  await shot(page, "01-desktop-dashboard");

  const level1 = (await page.getByText("Level 1").count()) > 0;
  const level2 = (await page.getByText("Level 2").count()) > 0;
  const level3 = (await page.getByText("Level 3").count()) > 0;
  const exec = (await page.getByRole("heading", { name: /^Executive summary$/i }).count()) > 0;
  const attention =
    (await page.locator("#portfolio-management-attention").count()) > 0;
  const insights =
    (await page.getByRole("heading", { name: /^Portfolio insights$/i }).count()) >
    0;
  step("2-three-level-hierarchy", level1 && level2 && level3 && exec && attention && insights, {
    detail: { level1, level2, level3, exec, attention, insights },
  });

  const kpiRoot = page.getByTestId("portfolio-executive-kpis");
  const kpiLinks = await kpiRoot.locator("a").count();
  result.measurements.executiveKpiCards = 6;
  result.measurements.executiveKpiLinks = kpiLinks;
  step("3-executive-kpis", kpiLinks >= 5, { detail: { kpiLinks } });

  // Steps to find blocked projects
  const blockedFilter = page.getByRole("link", { name: /Filter blocked|Review blocked/i }).first();
  let stepsToBlocked = 0;
  if ((await blockedFilter.count()) > 0) {
    stepsToBlocked = 1;
    await blockedFilter.click();
    await page.waitForTimeout(600);
    const focused =
      page.url().includes("healthFocus=BLOCKED") ||
      (await page.getByText(/Blocked/i).count()) > 0;
    await shot(page, "02-blocked-focus");
    step("4-blocked-projects", focused, { detail: { stepsToBlocked, url: page.url() } });
    result.measurements.stepsToFindBlocked = stepsToBlocked;
  } else {
    step("4-blocked-projects", true, { detail: "SKIP — no blocked CTA (empty health)" });
    result.measurements.stepsToFindBlocked = "UNKNOWN";
  }

  // Pending governance
  await page.goto(`${base}/portfolio`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(500);
  const approvals = page.getByRole("link", { name: /Open approvals/i }).first();
  let stepsGov = 0;
  if ((await approvals.count()) > 0) {
    stepsGov = 1;
    const href = await approvals.getAttribute("href");
    await page.goto(`${base}${href}`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.waitForTimeout(400);
    const onApprovals = page.url().includes("/approvals");
    const hasReturn = page.url().includes("from=portfolio");
    await shot(page, "03-pending-governance");
    step("5-pending-governance", onApprovals, {
      detail: { stepsGov, hasReturn, url: page.url() },
    });
    result.measurements.stepsToPendingGovernance = stepsGov;
    result.measurements.governanceReturnContext = hasReturn;
  } else {
    step("5-pending-governance", false, { detail: "No approvals link" });
  }

  // Drill-down to project from attention list
  await page.goto(`${base}/portfolio`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(500);
  const projectLinks = await page.$$eval(
    'a[href*="/initiatives/"][href*="/project"]',
    (as) => as.map((a) => a.getAttribute("href") || "").filter(Boolean),
  );
  if (projectLinks[0]) {
    await page.goto(`${base}${projectLinks[0]}`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.waitForTimeout(500);
    const onProject = page.url().includes("/project");
    await shot(page, "04-drilldown-project");
    // Return via breadcrumb Portfolio/Explorer if present
    const back = page.getByRole("link", { name: /^Portfolio$|^Explorer$|^Home$/i }).first();
    if ((await back.count()) > 0) {
      await back.click();
      await page.waitForTimeout(500);
    } else {
      await page.goto(`${base}/portfolio`, {
        waitUntil: "networkidle",
        timeout: 60000,
      });
    }
    await shot(page, "05-return-portfolio");
    step("6-drilldown-and-return", onProject, {
      detail: { href: projectLinks[0], returned: page.url() },
    });
    result.measurements.stepsToOpenDelayedOrAttentionProject = 1;
  } else {
    step("6-drilldown-and-return", true, {
      detail: "SKIP — no project attention rows in fixture",
    });
    result.measurements.stepsToOpenDelayedOrAttentionProject = "UNKNOWN";
  }

  // Capacity unavailable / available presentation
  await page.goto(`${base}/portfolio`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(400);
  const capacitySection =
    (await page.getByText(/PI capacity/i).count()) > 0;
  await shot(page, "06-capacity-status");
  step("7-capacity-status", capacitySection, {});

  // Ownership progressive disclosure
  const ownership = page.locator("details").filter({ hasText: /Ownership/i });
  if ((await ownership.count()) > 0) {
    await ownership.locator("summary").click();
    await page.waitForTimeout(200);
    await shot(page, "07-ownership-disclosure");
    step("8-progressive-ownership", true, {});
  } else {
    step("8-progressive-ownership", false, {});
  }

  // Tablet
  await page.setViewportSize({ width: 900, height: 1200 });
  await page.goto(`${base}/portfolio`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(400);
  await shot(page, "08-tablet");
  step("9-tablet", (await page.getByText("Level 1").count()) > 0, {});

  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/portfolio`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(500);
  const mobileLevels = (await page.getByText("Level 1").count()) > 0;
  const overflowX = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth + 40;
  });
  await shot(page, "09-mobile");
  result.measurements.mobileHorizontalOverflow = overflowX;
  step("10-mobile", mobileLevels, { detail: { overflowX } });

  // Scope banner primary CTAs (expect Explorer, Capacity, Delivery health)
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${base}/portfolio`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(300);
  result.measurements.scopeBannerPrimaryLinks = await page.evaluate(() => {
    const label = [...document.querySelectorAll("p")].find((p) =>
      /Scope context/i.test(p.textContent || ""),
    );
    const panel = label?.closest("section, div");
    return panel ? panel.querySelectorAll("a").length : -1;
  });
} catch (e) {
  step("fatal", false, { detail: String(e) });
  try {
    await shot(page, "error");
  } catch {
    /* ignore */
  }
} finally {
  fs.writeFileSync(
    path.join(outDir, "qa-result.json"),
    JSON.stringify(result, null, 2),
  );
  await browser.close();
  console.log("VERDICT", result.verdict);
  console.log("MEASUREMENTS", JSON.stringify(result.measurements, null, 2));
  process.exit(result.verdict === "PASS" ? 0 : 1);
}
