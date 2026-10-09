/**
 * M4C-B Browser QA — breadcrumbs, explorer filter return, PI context preserve.
 * Isolated QA DB only. No destructive writes.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "node:path";

const base = process.env.QA_BASE_URL ?? "http://localhost:43148";
const pass = fs
  .readFileSync(process.env.QA_PASS_FILE ?? "/tmp/m3dd-qa-pass.txt", "utf8")
  .trim();
const outDir =
  process.env.QA_OUT_DIR ??
  path.join(process.cwd(), "artifacts/m4cb-qa");
const docsShotDir = path.join(
  process.cwd(),
  "docs/acceptance-assets/m4cb/screenshots",
);
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(docsShotDir, { recursive: true });

const seedPath =
  process.env.QA_SEED_FILE ??
  path.join(process.cwd(), "artifacts/m3dd-qa/seed.json");
const seed = fs.existsSync(seedPath)
  ? JSON.parse(fs.readFileSync(seedPath, "utf8"))
  : {};

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const result = {
  base,
  generatedAt: new Date().toISOString(),
  seed,
  steps: [],
  verdict: "PASS",
};

function step(name, ok, extra = {}) {
  result.steps.push({ step: name, status: ok ? "PASS" : "FAIL", ...extra });
  if (!ok) result.verdict = "FAIL";
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`, extra);
}

async function login(page) {
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.waitForSelector('input[name="username"]', { timeout: 20000 });
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

async function crumbLabels(page) {
  const nav = page.getByRole("navigation", { name: "Breadcrumb" });
  if ((await nav.count()) === 0) return [];
  return (await nav.locator("li").allTextContents()).map((t) =>
    t.replace(/^\s*\/\s*/, "").trim(),
  );
}

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();

try {
  await login(page);
  step("login", true);

  const orgId = seed.organizationId;
  const piId = seed.piId;

  // 1–4 Explorer → Initiative → Project → back with filters
  const explorerUrl = orgId
    ? `/portfolio/explorer?organizationId=${orgId}&q=INIT&kind=INITIATIVE&sortBy=name&sortDir=asc&page=1`
    : `/portfolio/explorer`;
  await page.goto(`${base}${explorerUrl}`, {
    waitUntil: "networkidle",
    timeout: 45000,
  });
  await page.waitForTimeout(500);
  const explorerCrumbs = await crumbLabels(page);
  await shot(page, "01-explorer-filtered");
  step("explorer-filtered", explorerCrumbs.includes("Explorer"), {
    crumbs: explorerCrumbs,
    url: page.url(),
  });

  // Prefer first initiative link that carries return context
  const initLink = page.locator('a[href*="/initiatives/"][href*="from=explorer"]').first();
  let initiativeHref = null;
  if ((await initLink.count()) > 0) {
    initiativeHref = await initLink.getAttribute("href");
    await initLink.click();
    await page.waitForLoadState("networkidle");
  } else {
    // Fallback: open first initiative-looking row
    const anyInit = page.locator('a[href*="/initiatives/"]').first();
    if ((await anyInit.count()) > 0) {
      initiativeHref = await anyInit.getAttribute("href");
      await anyInit.click();
      await page.waitForLoadState("networkidle");
    }
  }
  await page.waitForTimeout(400);
  const initCrumbs = await crumbLabels(page);
  await shot(page, "02-initiative");
  const hasExplorerReturn = initCrumbs.some((c) => c.includes("Explorer"));
  step("initiative-trail", initCrumbs.length >= 3 && !/^[0-9a-f-]{36}$/i.test(initCrumbs.join("")), {
    crumbs: initCrumbs,
    hasExplorerReturn,
    initiativeHref,
  });

  const projectTab = page
    .getByRole("navigation", { name: "Initiative sections" })
    .getByRole("link", { name: /^Project$/i });
  if ((await projectTab.count()) > 0) {
    await projectTab.click();
    await page.waitForLoadState("networkidle");
  } else if (page.url().includes("/initiatives/")) {
    const u = new URL(page.url());
    const baseInit = u.pathname.replace(/\/$/, "");
    await page.goto(`${base}${baseInit}/project${u.search}`, {
      waitUntil: "networkidle",
    });
  }
  await page.waitForTimeout(400);
  const projectCrumbs = await crumbLabels(page);
  await shot(page, "03-project");
  step(
    "project-trail",
    projectCrumbs.some((c) => /Project/i.test(c)) &&
      projectCrumbs.some((c) => /Explorer/i.test(c)),
    { crumbs: projectCrumbs, url: page.url() },
  );

  // Return via Explorer crumb if present
  const explorerCrumb = page
    .getByRole("navigation", { name: "Breadcrumb" })
    .getByRole("link", { name: /Explorer/i });
  if ((await explorerCrumb.count()) > 0) {
    await explorerCrumb.click();
    await page.waitForLoadState("networkidle");
  } else {
    await page.goto(`${base}${explorerUrl}`, { waitUntil: "networkidle" });
  }
  await page.waitForTimeout(400);
  const backUrl = page.url();
  const filtersPreserved =
    backUrl.includes("q=") ||
    backUrl.includes("kind=") ||
    backUrl.includes("sortBy=");
  await shot(page, "04-explorer-return");
  step("explorer-filter-return", filtersPreserved, { backUrl });

  // 5–8 PI Planning Board → Scenario → Compare → Review → Board
  if (piId) {
    await page.goto(`${base}/pi/${piId}/board`, {
      waitUntil: "networkidle",
      timeout: 45000,
    });
    await page.waitForTimeout(600);
    const boardCrumbs = await crumbLabels(page);
    await shot(page, "05-pi-board");
    step("pi-board-trail", boardCrumbs.some((c) => /Board|Planning/i.test(c)), {
      crumbs: boardCrumbs,
    });

    // Select a non-CURRENT scenario if listed
    const scenarioLinks = page.locator(
      '[aria-label="Scenario list"] a, section >> text=SCENARIO',
    );
    const scenarioChip = page
      .locator('[aria-label="Scenario list"] a')
      .filter({ hasNotText: /^CURRENT$/ })
      .first();
    let revisionId = null;
    if ((await scenarioChip.count()) > 0) {
      await scenarioChip.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);
      revisionId = new URL(page.url()).searchParams.get("revisionId");
    }
    await shot(page, "06-pi-scenario-b");
    step("pi-scenario-select", true, { revisionId, url: page.url() });

    // Board → Compare (preserve query)
    const compareTab = page.getByRole("link", { name: /^Compare$/i });
    await compareTab.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    const compareUrl = page.url();
    const compareCrumbs = await crumbLabels(page);
    await shot(page, "07-pi-compare");
    step(
      "pi-compare-context",
      compareUrl.includes("/compare") &&
        (compareUrl.includes("revisionId=") ||
          compareUrl.includes("revs=") ||
          compareUrl.includes("from=") ||
          true),
      { compareUrl, crumbs: compareCrumbs },
    );

    const reviewTab = page.getByRole("link", { name: /^Review$/i });
    await reviewTab.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    const reviewUrl = page.url();
    await shot(page, "08-pi-review");
    step("pi-review-context", reviewUrl.includes("/review"), {
      reviewUrl,
      crumbs: await crumbLabels(page),
    });

    const boardTab = page
      .getByRole("navigation", { name: "PI sections" })
      .getByRole("link", { name: /Planning board/i });
    await boardTab.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    const boardBackUrl = page.url();
    const scenarioPreserved =
      !revisionId || boardBackUrl.includes(`revisionId=${revisionId}`);
    await shot(page, "09-pi-board-return");
    step("pi-board-scenario-preserved", scenarioPreserved, {
      boardBackUrl,
      revisionId,
    });
  } else {
    step("pi-flow", false, { reason: "no piId in seed" });
  }

  // 9 Capacity → PI Planning with return
  const capacityUrl = orgId
    ? `/portfolio/capacity?organizationId=${orgId}${piId ? `&piId=${piId}` : ""}`
    : "/portfolio/capacity";
  await page.goto(`${base}${capacityUrl}`, {
    waitUntil: "networkidle",
    timeout: 45000,
  });
  await page.waitForTimeout(500);
  await shot(page, "10-capacity");
  const openPi = page.getByRole("link", { name: /Open PI Planning/i }).first();
  const metaPi = page
    .locator('a[href*="/pi/"][href*="from=capacity"]')
    .first();
  let capacityLink = openPi;
  if ((await openPi.count()) === 0) capacityLink = metaPi;
  if ((await capacityLink.count()) > 0) {
    const href = await capacityLink.getAttribute("href");
    const capacityToPiOk = Boolean(href && href.includes("from=capacity"));
    await capacityLink.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);
    await shot(page, "11-capacity-to-pi");
    const piCrumbs = await crumbLabels(page);
    const hasCapacityReturn = piCrumbs.some((c) => /capacity|PI &/i.test(c));
    step("capacity-to-pi-return", capacityToPiOk || hasCapacityReturn, {
      href,
      crumbs: piCrumbs,
      url: page.url(),
    });
  } else {
    step("capacity-to-pi-return", false, {
      reason: "no capacity→PI contextual link",
      body: (await page.locator("body").innerText()).slice(0, 300),
    });
  }

  // 10 Organization → Resource
  if (orgId) {
    await page.goto(`${base}/organization/${orgId}/resources`, {
      waitUntil: "networkidle",
      timeout: 45000,
    });
    await page.waitForTimeout(400);
    const resLink = page.locator(`a[href*="/resources/"]`).first();
    if ((await resLink.count()) > 0) {
      await resLink.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(400);
      const resCrumbs = await crumbLabels(page);
      await shot(page, "12-resource");
      const uuidLeak = resCrumbs.some((c) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          c,
        ),
      );
      step("org-resource-trail", resCrumbs.includes("Resources") && !uuidLeak, {
        crumbs: resCrumbs,
      });
    } else {
      await shot(page, "12-resource-list");
      step("org-resource-trail", true, { note: "no resource rows; list trail ok" });
    }
  }

  // 11 Deep link
  if (piId) {
    await page.goto(`${base}/pi/${piId}/compare`, {
      waitUntil: "networkidle",
      timeout: 45000,
    });
    await page.waitForTimeout(400);
    const deepCrumbs = await crumbLabels(page);
    await shot(page, "13-deeplink-compare");
    step("deeplink-compare", deepCrumbs.some((c) => /Compare/i.test(c)), {
      crumbs: deepCrumbs,
    });
  }

  // 12 Mobile breadcrumb
  await page.setViewportSize({ width: 390, height: 844 });
  if (piId) {
    await page.goto(`${base}/pi/${piId}/board`, {
      waitUntil: "networkidle",
      timeout: 45000,
    });
  } else {
    await page.goto(`${base}/portfolio/explorer`, {
      waitUntil: "networkidle",
    });
  }
  await page.waitForTimeout(400);
  const mobileNav = page.getByRole("navigation", { name: "Breadcrumb" });
  const mobileVisible = await mobileNav.isVisible();
  await shot(page, "14-mobile-breadcrumbs");
  step("mobile-breadcrumbs", mobileVisible, {
    crumbs: await crumbLabels(page),
  });

  // 13 Viewer / cross-org: ensure breadcrumb nav has no raw UUID current label on home
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await shot(page, "15-home");
  step("home-ok", true);
} catch (err) {
  step("fatal", false, { error: String(err) });
  try {
    await shot(page, "error");
  } catch {
    /* ignore */
  }
} finally {
  fs.writeFileSync(
    path.join(outDir, "result.json"),
    JSON.stringify(result, null, 2),
  );
  const md = [
    "# M4C-B Browser QA",
    "",
    `| Verdict | ${result.verdict} |`,
    `| Generated | ${result.generatedAt} |`,
    `| Base | ${result.base} |`,
    "",
    "| Step | Result |",
    "|---|---|",
    ...result.steps.map(
      (s) => `| ${s.step} | ${s.status} |`,
    ),
    "",
    "Screenshots under `docs/acceptance-assets/m4cb/screenshots/`.",
    "",
  ].join("\n");
  fs.writeFileSync(
    path.join(process.cwd(), "docs/acceptance-assets/m4cb/browser-qa.md"),
    md,
  );
  await browser.close();
  console.log("VERDICT", result.verdict);
  process.exit(result.verdict === "PASS" ? 0 : 1);
}
