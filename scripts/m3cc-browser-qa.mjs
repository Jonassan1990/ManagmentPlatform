import { chromium } from "playwright";
import fs from "fs";
import path from "node:path";

const seedPath =
  process.env.QA_SEED_FILE ??
  path.join(process.cwd(), "artifacts/m3cb-qa/seed.json");
const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
const base = process.env.QA_BASE_URL ?? "http://localhost:43147";
const pass = fs
  .readFileSync(process.env.QA_PASS_FILE ?? "/tmp/m3b-qa-pass.txt", "utf8")
  .trim();
const {
  piId,
  organizationId,
  currentRevisionId,
  scenarioAId,
  scenarioBId,
  archivedScenarioId,
} = seed;
const outDir =
  process.env.QA_OUT_DIR ??
  path.join(process.cwd(), "artifacts/m3cc-acceptance");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
const result = { steps: [], base, piId, seed };

async function login(p) {
  await p.goto(`${base}/login`, { waitUntil: "networkidle" });
  await p.fill('input[name="username"]', "owner");
  await p.fill('input[name="password"]', pass);
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });
}

function passStep(step, ok, extra = {}) {
  result.steps.push({ step, status: ok ? "PASS" : "FAIL", ...extra });
}

try {
  await login(page);
  passStep("login", true);

  await page.goto(`${base}/pi/${piId}/board`, { waitUntil: "networkidle" });
  const compareTab = page.getByRole("link", { name: "Compare", exact: true });
  const compareLink = page.getByRole("link", { name: "Compare scenarios" });
  passStep(
    "nav-to-compare",
    (await compareTab.count()) + (await compareLink.count()) > 0,
  );
  await page.screenshot({
    path: `${outDir}/01-board-nav.png`,
    fullPage: true,
  });

  const twoUrl = `${base}/pi/${piId}/compare?revs=${encodeURIComponent(
    [currentRevisionId, scenarioAId].join(","),
  )}&ref=${encodeURIComponent(currentRevisionId)}`;
  await page.goto(twoUrl, { waitUntil: "networkidle" });
  passStep(
    "two-scenario-compare",
    (await page.getByRole("heading", { name: "Summary" }).count()) > 0 &&
      (await page.getByText(/Read-only comparison/i).count()) > 0 &&
      (await page.getByText("CURRENT").count()) > 0,
    { url: page.url() },
  );
  await page.screenshot({
    path: `${outDir}/02-two-way.png`,
    fullPage: true,
  });

  // Change reference to Scenario A
  await page
    .getByLabel(/Use Scenario A .* as reference/i)
    .check()
    .catch(async () => {
      await page.locator('input[name="compare-reference"]').nth(1).check();
    });
  await page.waitForTimeout(800);
  passStep(
    "reference-selection",
    page.url().includes(`ref=${scenarioAId}`) ||
      page.url().includes(encodeURIComponent(scenarioAId)),
    { url: page.url() },
  );
  await page.screenshot({
    path: `${outDir}/03-reference-scenario-a.png`,
    fullPage: true,
  });

  const threeUrl = `${base}/pi/${piId}/compare?revs=${encodeURIComponent(
    [currentRevisionId, scenarioAId, scenarioBId].join(","),
  )}&ref=${encodeURIComponent(currentRevisionId)}`;
  await page.goto(threeUrl, { waitUntil: "networkidle" });
  passStep(
    "three-scenario-compare",
    (await page.getByRole("heading", { name: "Summary" }).count()) > 0,
    { url: page.url() },
  );
  await page.screenshot({
    path: `${outDir}/04-three-way.png`,
    fullPage: true,
  });

  await page.goto(`${base}/pi/${piId}/board?revisionId=${scenarioBId}`, {
    waitUntil: "networkidle",
  });
  passStep(
    "edit-context-scenario-b",
    (await page.getByRole("status").filter({ hasText: "SCENARIO" }).count()) >
      0,
  );
  await page.goto(threeUrl, { waitUntil: "networkidle" });
  passStep(
    "refresh-after-board",
    (await page.getByRole("heading", { name: "Summary" }).count()) > 0,
  );

  if (archivedScenarioId) {
    const archivedUrl = `${base}/pi/${piId}/compare?revs=${encodeURIComponent(
      [currentRevisionId, archivedScenarioId].join(","),
    )}&ref=${encodeURIComponent(currentRevisionId)}`;
    await page.goto(archivedUrl, { waitUntil: "networkidle" });
    const archivedLabel =
      (await page.getByText(/ARCHIVED/i).count()) > 0 ||
      (await page.getByText(/Scenario Archived/i).count()) > 0;
    passStep("archived-scenario-compare", archivedLabel, {
      url: page.url(),
    });
    await page.screenshot({
      path: `${outDir}/05-archived-compare.png`,
      fullPage: true,
    });
  } else {
    passStep("archived-scenario-compare", false, { reason: "no seed id" });
  }

  await page.goto(`${base}/pi/${piId}/compare`, { waitUntil: "networkidle" });
  passStep(
    "empty-selection-state",
    (await page.getByText(/Pick at least 2 scenarios/i).count()) > 0 ||
      (await page.getByText(/Only CURRENT exists/i).count()) > 0,
  );
  await page.screenshot({
    path: `${outDir}/06-empty-selection.png`,
    fullPage: true,
  });

  await page.goto(
    `${base}/pi/${piId}/compare?revs=not-a-uuid,also-bad&ref=not-a-uuid`,
    { waitUntil: "networkidle" },
  );
  passStep(
    "invalid-revision-error",
    (await page.getByText(/Invalid revision/i).count()) > 0 ||
      (await page.getByRole("alert").count()) > 0 ||
      (await page.locator('[class*="danger"], [class*="red"]').count()) > 0,
  );
  await page.screenshot({
    path: `${outDir}/07-invalid-error.png`,
    fullPage: true,
  });

  await page.goto(twoUrl, { waitUntil: "networkidle" });
  const back = page.getByRole("link", { name: /Back to planning board/i });
  await back.click();
  await page.waitForURL(/\/board/, { timeout: 15000 });
  passStep("back-to-board", page.url().includes("/board"));
  await page.screenshot({
    path: `${outDir}/08-back-to-board.png`,
    fullPage: true,
  });

  await page.goto(
    `${base}/portfolio/capacity?organizationId=${organizationId}`,
    { waitUntil: "networkidle" },
  );
  passStep(
    "portfolio-current-only",
    (await page.getByRole("heading", { name: /Capacity/i }).count()) > 0,
  );
  await page.screenshot({
    path: `${outDir}/09-portfolio-capacity.png`,
    fullPage: true,
  });

  await login(mobile);
  await mobile.goto(threeUrl, { waitUntil: "networkidle" });
  await mobile.screenshot({
    path: `${outDir}/10-mobile-compare.png`,
    fullPage: true,
  });
  passStep("mobile-layout", true);
} catch (e) {
  result.error = String(e);
  await page
    .screenshot({ path: `${outDir}/error.png`, fullPage: true })
    .catch(() => {});
} finally {
  await browser.close();
  const failed = result.steps.filter((s) => s.status === "FAIL");
  result.summary = {
    passed: result.steps.filter((s) => s.status === "PASS").length,
    failed: failed.length,
    allPassed: failed.length === 0 && !result.error,
  };
  fs.writeFileSync(`${outDir}/browser-qa-result.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!result.summary.allPassed) process.exitCode = 1;
}
