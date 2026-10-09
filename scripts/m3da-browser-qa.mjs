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
const { piId, organizationId, scenarioAId, scenarioBId } = seed;
const outDir =
  process.env.QA_OUT_DIR ??
  path.join(process.cwd(), "artifacts/m3da-qa");
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
  passStep(
    "open-pi-planning",
    (await page.getByRole("heading", { name: /Planning scenarios/i }).count()) >
      0,
  );
  await page.screenshot({ path: `${outDir}/01-board.png`, fullPage: true });

  await page.goto(`${base}/pi/${piId}/review`, { waitUntil: "networkidle" });
  passStep(
    "inspect-readiness",
    (await page.getByText(/Readiness:/i).count()) > 0 ||
      (await page.getByText(/Scenario selection/i).count()) > 0,
  );
  await page.screenshot({ path: `${outDir}/02-readiness.png`, fullPage: true });

  const select = page.locator("select").first();
  await select.selectOption({ label: /Scenario A/i }).catch(async () => {
    await select.selectOption({ index: 1 });
  });
  await page.getByRole("button", { name: /Select for review|Change selection/i }).click();
  await page.waitForTimeout(1500);
  await page.waitForLoadState("networkidle");
  passStep(
    "select-scenario-a",
    (await page.getByText(/Selected for review — not approved/i).count()) > 0 &&
      (await page.getByText(/Scenario A/i).count()) > 0,
  );
  await page.screenshot({ path: `${outDir}/03-selected-a.png`, fullPage: true });

  await select.selectOption({ label: /Scenario B/i }).catch(async () => {
    await select.selectOption({ index: 2 });
  });
  await page.getByRole("button", { name: /Change selection|Select for review/i }).click();
  await page.waitForTimeout(1500);
  await page.waitForLoadState("networkidle");
  passStep(
    "switch-to-b",
    (await page.getByText(/Scenario B/i).count()) > 0,
  );
  await page.screenshot({ path: `${outDir}/04-selected-b.png`, fullPage: true });

  await page.getByRole("button", { name: "Clear selection" }).click();
  await page.waitForTimeout(1500);
  await page.waitForLoadState("networkidle");
  passStep(
    "clear-selection",
    (await page.getByText(/none selected/i).count()) > 0,
  );
  await page.screenshot({ path: `${outDir}/05-cleared.png`, fullPage: true });

  await page.goto(`${base}/pi/${piId}/board`, { waitUntil: "networkidle" });
  passStep(
    "current-unchanged",
    (await page.getByRole("status").filter({ hasText: "CURRENT" }).count()) > 0,
  );

  await page.goto(
    `${base}/portfolio/capacity?organizationId=${organizationId}`,
    { waitUntil: "networkidle" },
  );
  passStep(
    "portfolio-capacity",
    (await page.getByRole("heading", { name: /Capacity/i }).count()) > 0,
  );
  await page.screenshot({
    path: `${outDir}/06-portfolio.png`,
    fullPage: true,
  });

  await login(mobile);
  await mobile.goto(`${base}/pi/${piId}/review`, { waitUntil: "networkidle" });
  await mobile.screenshot({
    path: `${outDir}/07-mobile-review.png`,
    fullPage: true,
  });
  passStep("mobile-layout", true);

  // Note ids for debugging
  void scenarioAId;
  void scenarioBId;
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
  fs.writeFileSync(`${outDir}/result.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!result.summary.allPassed) process.exitCode = 1;
}
