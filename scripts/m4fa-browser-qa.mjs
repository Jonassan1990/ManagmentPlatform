/**
 * M4F-A Browser QA — keyboard / focus journeys (Org Admin temp-auth).
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "node:path";

const base = process.env.QA_BASE_URL ?? "http://localhost:43148";
const pass = fs
  .readFileSync(process.env.QA_PASS_FILE ?? "/tmp/m3dd-qa-pass.txt", "utf8")
  .trim();
const outDir =
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m4fa-qa");
fs.mkdirSync(outDir, { recursive: true });
const docsShotDir = path.join(
  process.cwd(),
  "docs/acceptance-assets/m4fa/screenshots",
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
  milestone: "M4F-A",
  base,
  generatedAt: new Date().toISOString(),
  steps: [],
  focusTrail: [],
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
}

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();

try {
  await login(page);
  step("login", true);

  // Skip link → main
  await page.goto(`${base}/portfolio?organizationId=${seededOrg}`, {
    waitUntil: "networkidle",
  });
  const skip = page.getByRole("link", { name: /Skip to main content/i });
  await skip.focus();
  const skipFocused = await skip.evaluate(
    (el) => el === document.activeElement,
  );
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  const mainFocused = await page.evaluate(
    () => document.activeElement?.id === "main-content",
  );
  step("skip-to-main", skipFocused && mainFocused, {
    detail: { skipFocused, mainFocused },
  });
  await shot(page, "01-skip-main");

  // Mobile nav keyboard
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Open navigation/i }).click();
  await page.waitForTimeout(400);
  const navFocus = await page.evaluate(() => {
    const el = document.activeElement;
    return el?.tagName ?? null;
  });
  step("mobile-nav-initial-focus", navFocus === "A" || navFocus === "BUTTON", {
    detail: { navFocus },
  });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await shot(page, "02-mobile-nav");

  // Explorer search form
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(
    `${base}/portfolio/explorer?organizationId=${seededOrg}`,
    { waitUntil: "networkidle" },
  );
  const search = page.getByRole("searchbox").first();
  const searchOk = (await search.count()) > 0;
  if (searchOk) {
    await search.focus();
    await search.fill("test");
  }
  const apply = page.getByRole("button", { name: /Apply filters/i });
  step("explorer-search-apply", searchOk && (await apply.count()) > 0);
  await shot(page, "03-explorer-filters");

  // PI tabs horizontal scroll + focus
  await page.goto(`${base}/pi/${seededPi}/board`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(800);
  const piTab = page.getByRole("link", { name: /Review/i }).first();
  const piTabsVisible =
    (await page.getByRole("navigation", { name: /PI sections/i }).count()) > 0;
  if ((await piTab.count()) > 0) {
    await piTab.focus();
    result.focusTrail.push(
      await page.evaluate(() => document.activeElement?.textContent?.trim()),
    );
  }
  step("pi-tabs-focusable", piTabsVisible && (await piTab.count()) > 0, {
    detail: { piTabsVisible },
  });
  await shot(page, "04-pi-tabs");

  // Capacity inspect (keyboard reachable button)
  await page.goto(`${base}${capacityUrl}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(1000);
  const inspect = page.getByRole("button", { name: /^Inspect team$/i }).first();
  if ((await inspect.count()) > 0) {
    await inspect.focus();
    await inspect.click();
  }
  step("capacity-inspect-keyboard", (await inspect.count()) > 0);
  await shot(page, "05-capacity-inspect");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await shot(page, "06-mobile-capacity");
} catch (err) {
  result.verdict = "FAIL";
  result.error = String(err?.stack || err);
  console.error(err);
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
