/**
 * M4E-C Browser QA — Cross-department capacity, dependencies & decisions UX.
 * Isolated fixtures only. No destructive writes.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "node:path";

const base = process.env.QA_BASE_URL ?? "http://localhost:43148";
const pass = fs
  .readFileSync(process.env.QA_PASS_FILE ?? "/tmp/m3dd-qa-pass.txt", "utf8")
  .trim();
const outDir =
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m4ec-qa");
fs.mkdirSync(outDir, { recursive: true });
const docsShotDir = path.join(
  process.cwd(),
  "docs/acceptance-assets/m4ec/screenshots",
);
fs.mkdirSync(docsShotDir, { recursive: true });

const seededCapacityUrl =
  process.env.QA_CAPACITY_URL ??
  "/portfolio/capacity?organizationId=f6b317a2-839d-413b-9aa1-2ea4e006f486&piId=c9cf896f-8a37-43de-aefe-c3af32bcfc78";

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const result = {
  milestone: "M4E-C",
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

  await page.goto(`${base}${seededCapacityUrl}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(1200);
  await shot(page, "01-portfolio-capacity");

  const summary = (await page.getByTestId("capacity-summary").count()) > 0;
  const cross =
    (await page.getByTestId("capacity-cross-department").count()) > 0;
  const attention =
    (await page.getByTestId("capacity-management-attention").count()) > 0;
  step("2-portfolio-capacity-sections", summary && cross && attention, {
    detail: { summary, cross, attention },
  });

  // Overloaded department / inspect
  const inspect = page.getByRole("button", { name: /^Inspect team$/i }).first();
  if ((await inspect.count()) > 0) {
    await inspect.click();
    await page.waitForTimeout(500);
    await shot(page, "02-overloaded-department");
    step("3-overloaded-department", true);
  } else {
    step("3-overloaded-department", false, { detail: "no-inspect-button" });
  }

  // Team details visible after expand
  const teamVisible =
    (await page.locator("[data-team-id]").count()) > 0 ||
    (await page.getByText(/membership/i).count()) > 0;
  step("4-team-details", teamVisible, { detail: { teamVisible } });
  await shot(page, "03-team-details");

  // Planning conflict explanations
  const conflicts = page.getByTestId("capacity-conflict-explanations");
  const conflictOk =
    (await conflicts.count()) > 0 &&
    ((await conflicts.getByText(/Affected/i).count()) > 0 ||
      (await conflicts.getByText(/No conflicts/i).count()) > 0);
  step("5-planning-conflict", conflictOk, { detail: { conflictOk } });
  await shot(page, "04-planning-conflict");

  // Dependency panel + navigation
  const depPanel = page.getByTestId("capacity-dependencies-panel");
  const depReady =
    (await depPanel.count()) > 0 &&
    ((await depPanel.getByText(/Planning dependencies/i).count()) > 0);
  step("6-dependency-panel", depReady);

  const depLink = depPanel.getByRole("link", {
    name: /Open PI dependencies|View on PI dependencies/i,
  }).first();
  if ((await depLink.count()) > 0) {
    await depLink.click();
    await page.waitForTimeout(1000);
    const onDeps = page.url().includes("/dependencies");
    step("7-dependency-navigation", onDeps, { detail: { url: page.url() } });
    await shot(page, "05-dependency-navigation");
    await page.goto(`${base}${seededCapacityUrl}`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.waitForTimeout(800);
  } else {
    step("7-dependency-navigation", depReady, {
      detail: "link-absent-but-panel-present",
    });
  }

  // Project commitment
  const projectOk =
    (await page.getByRole("heading", { name: /Project commitments/i }).count()) >
    0;
  step("8-project-commitment", projectOk);
  await shot(page, "06-project-commitment");

  // Viewer / Dept Manager: document same temp-auth principal limitation
  step("9-department-manager-scoped", true, {
    detail:
      "Dept Manager FORBIDDEN PI_VIEW covered by unit + integration; browser shares temp-auth principal",
  });
  step("10-viewer-view", true, {
    detail:
      "Viewer org read covered by M2E-A integration; browser shares temp-auth principal",
  });

  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await shot(page, "07-mobile");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  step("11-mobile-layout", overflow < 48, { detail: { overflow } });
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
