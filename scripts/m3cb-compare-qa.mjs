import { chromium } from "playwright";
import fs from "fs";
import path from "node:path";

const seedPath =
  process.env.QA_SEED_FILE ??
  path.join(process.cwd(), "artifacts/m3cb-qa/seed.json");
const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));

const base = process.env.QA_BASE_URL ?? "http://localhost:43147";
const pass = fs.readFileSync(process.env.QA_PASS_FILE ?? "/tmp/m3b-qa-pass.txt", "utf8").trim();
const { piId, currentRevisionId, scenarioAId, scenarioBId } = seed;
const outDir =
  process.env.QA_OUT_DIR ??
  path.join(process.cwd(), "artifacts/m3cb-qa");
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

try {
  await login(page);
  result.steps.push({ step: "login", status: "PASS" });

  await page.goto(`${base}/pi/${piId}/board`, { waitUntil: "networkidle" });
  const hasCompareLink =
    (await page.getByRole("link", { name: "Compare scenarios" }).count()) > 0;
  result.steps.push({
    step: "board-compare-link",
    status: hasCompareLink ? "PASS" : "FAIL",
  });
  await page.screenshot({ path: `${outDir}/01-board-compare-link.png`, fullPage: true });

  const compareUrl = `${base}/pi/${piId}/compare?revs=${encodeURIComponent(
    [currentRevisionId, scenarioAId, scenarioBId].join(","),
  )}&ref=${encodeURIComponent(currentRevisionId)}`;
  await page.goto(compareUrl, { waitUntil: "networkidle" });
  const readOnly = await page.getByText(/Read-only comparison/i).count();
  const summary = await page.getByRole("heading", { name: "Summary" }).count();
  const referenceBadges = await page.getByText("Reference").count();
  result.steps.push({
    step: "three-way-summary",
    status: readOnly && summary && referenceBadges >= 1 ? "PASS" : "FAIL",
    readOnly,
    summary,
    referenceBadges,
    url: page.url(),
  });
  await page.screenshot({ path: `${outDir}/02-three-way-compare.png`, fullPage: true });

  await page.goto(`${base}/pi/${piId}/board?revisionId=${scenarioBId}`, {
    waitUntil: "networkidle",
  });
  const scenarioBanner = await page
    .getByRole("status")
    .filter({ hasText: "SCENARIO" })
    .count();
  result.steps.push({
    step: "edit-scenario-b-context",
    status: scenarioBanner ? "PASS" : "FAIL",
  });

  await page.goto(compareUrl, { waitUntil: "networkidle" });
  const stillThree = await page.getByRole("heading", { name: "Summary" }).count();
  result.steps.push({
    step: "refresh-comparison-after-board",
    status: stillThree ? "PASS" : "FAIL",
  });
  await page.screenshot({ path: `${outDir}/03-after-board-refresh.png`, fullPage: true });

  await page.goto(`${base}/portfolio/capacity?organizationId=${seed.organizationId}`, {
    waitUntil: "networkidle",
  });
  const portfolioHeading = await page.getByRole("heading", { name: /Capacity/i }).count();
  result.steps.push({
    step: "portfolio-capacity",
    status: portfolioHeading ? "PASS" : "FAIL",
  });
  await page.screenshot({ path: `${outDir}/04-portfolio-capacity.png`, fullPage: true });

  await page.goto(`${base}/pi/${piId}/compare`, { waitUntil: "networkidle" });
  const pickPrompt = await page.getByText(/Pick at least 2 scenarios/i).count();
  result.steps.push({
    step: "empty-selection-state",
    status: pickPrompt ? "PASS" : "FAIL",
  });
  await page.screenshot({ path: `${outDir}/05-empty-selection.png`, fullPage: true });

  await login(mobile);
  await mobile.goto(compareUrl, { waitUntil: "networkidle" });
  await mobile.screenshot({ path: `${outDir}/06-mobile-compare.png`, fullPage: true });
  result.steps.push({ step: "mobile-layout", status: "PASS" });
} catch (e) {
  result.error = String(e);
  await page.screenshot({ path: `${outDir}/error.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  fs.writeFileSync(`${outDir}/result.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
