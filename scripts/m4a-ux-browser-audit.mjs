/**
 * M4A UX browser audit — capture major screens (desktop + mobile).
 * Isolated QA DB only. No destructive integration tests.
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
  path.join(process.cwd(), "artifacts/m4a-ux-audit");
fs.mkdirSync(outDir, { recursive: true });

const seedPath =
  process.env.QA_SEED_FILE ??
  path.join(process.cwd(), "artifacts/m3dd-qa/seed.json");
let seed = {};
if (fs.existsSync(seedPath)) {
  seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
}

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
  notes: [],
};

function step(name, ok, extra = {}) {
  result.steps.push({ step: name, status: ok ? "PASS" : "FAIL", ...extra });
}

async function login(page) {
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[name="username"]', { timeout: 20000 });
  await page.fill('input[name="username"]', "owner");
  await page.fill('input[name="password"]', pass);
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForFunction(() => !location.pathname.includes("/login"), {
    timeout: 20000,
  });
}

async function shot(page, name, fullPage = true) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage });
  return file;
}

async function visit(page, route, name, checks = []) {
  try {
    await page.goto(`${base}${route}`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(400);
    const body = await page.locator("body").innerText();
    const okChecks = checks.every((c) =>
      typeof c === "string" ? body.toLowerCase().includes(c.toLowerCase()) : c,
    );
    await shot(page, name);
    // Heuristics
    const headings = await page.locator("h1,h2").allTextContents();
    const buttons = await page.getByRole("button").count();
    const links = await page.getByRole("link").count();
    const tables = await page.locator("table").count();
    const forms = await page.locator("form").count();
    step(name, okChecks, {
      route,
      headings: headings.slice(0, 8),
      buttons,
      links,
      tables,
      forms,
      bodyChars: body.length,
    });
  } catch (e) {
    await shot(page, `${name}-error`).catch(() => {});
    step(name, false, { route, error: String(e) });
  }
}

const desktop = await browser.newPage({
  viewport: { width: 1440, height: 900 },
});
const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
});

try {
  await login(desktop);
  step("login-desktop", true);
  await shot(desktop, "00-login-success-redirect");

  // Shell / overview
  await visit(desktop, "/", "01-overview", ["Management", "Overview"]);
  await visit(desktop, "/portfolio", "02-portfolio-dashboard", [
    "Portfolio",
  ]);
  await visit(desktop, "/portfolio/explorer", "03-portfolio-explorer", [
    "Explorer",
  ]);
  await visit(desktop, "/portfolio/health", "04-delivery-health", [
    "health",
  ]);
  await visit(desktop, "/portfolio/capacity", "05-pi-capacity", [
    "Capacity",
  ]);
  await visit(desktop, "/organization", "06-organization", ["Organization"]);
  await visit(desktop, "/initiatives", "07-initiatives", ["Initiative"]);
  await visit(desktop, "/approvals", "08-approvals", ["Approval"]);
  await visit(desktop, "/decisions", "09-decisions", ["Decision"]);
  await visit(desktop, "/pi", "10-pi-list", ["PI", "Planning"]);

  // Org drill if seed has org
  if (seed.organizationId) {
    await visit(
      desktop,
      `/organization/${seed.organizationId}`,
      "11-org-detail",
      ["Organization"],
    );
    await visit(
      desktop,
      `/organization/${seed.organizationId}/resources`,
      "12-resources",
      ["Resource"],
    );
    await visit(
      desktop,
      `/organization/${seed.organizationId}/access`,
      "13-access-roles",
      ["Access", "Role"],
    );
  } else {
    result.notes.push("No organizationId in seed — org detail NOT VERIFIED");
  }

  // Initiatives list → first initiative if present
  await desktop.goto(`${base}/initiatives`, { waitUntil: "networkidle" });
  const initLink = desktop.locator('a[href^="/initiatives/"]').first();
  if ((await initLink.count()) > 0) {
    const href = await initLink.getAttribute("href");
    if (href && !href.includes("/new")) {
      await visit(desktop, href, "14-initiative-workspace", ["Initiative"]);
      await visit(desktop, `${href}/requirements`, "15-requirements", []);
      await visit(desktop, `${href}/governance`, "16-governance", []);
      await visit(desktop, `${href}/project`, "17-project", []);
    }
  } else {
    result.notes.push("No initiative links — Journey A detail NOT VERIFIED");
    step("14-initiative-workspace", false, { note: "NOT VERIFIED" });
  }

  // PI Planning deep dive from seed
  if (seed.piId) {
    const pi = seed.piId;
    await visit(desktop, `/pi/${pi}`, "20-pi-overview", ["PI"]);
    await visit(desktop, `/pi/${pi}/board`, "21-pi-board", ["Planning"]);
    await visit(desktop, `/pi/${pi}/compare`, "22-pi-compare", ["Compare"]);
    await visit(desktop, `/pi/${pi}/capacity`, "23-pi-capacity", ["Capacity"]);
    await visit(desktop, `/pi/${pi}/review`, "24-pi-review", ["Review"]);
    await visit(desktop, `/pi/${pi}/baseline`, "25-pi-baseline", ["Baseline"]);
    await visit(desktop, `/pi/${pi}/dependencies`, "26-pi-dependencies", []);
    await visit(desktop, `/pi/${pi}/settings`, "27-pi-settings", []);
  } else {
    result.notes.push("No piId in seed — PI deep dive uses /pi list only");
  }

  // Keyboard / a11y spot checks on review
  if (seed.piId) {
    await desktop.goto(`${base}/pi/${seed.piId}/review`, {
      waitUntil: "networkidle",
    });
    await desktop.keyboard.press("Tab");
    await desktop.keyboard.press("Tab");
    const focused = await desktop.evaluate(() => {
      const el = document.activeElement;
      return {
        tag: el?.tagName,
        role: el?.getAttribute("role"),
        text: (el?.textContent || "").slice(0, 80),
        outline: getComputedStyle(el).outlineStyle,
      };
    });
    step("a11y-keyboard-tab-review", true, { focused });
    // Landmark check
    const landmarks = await desktop.evaluate(() => ({
      nav: document.querySelectorAll("nav").length,
      main: document.querySelectorAll("main").length,
      h1: document.querySelectorAll("h1").length,
      labeledButtons: [
        ...document.querySelectorAll("button"),
      ].filter((b) => (b.getAttribute("aria-label") || b.textContent || "").trim())
        .length,
      unlabeledInputs: [
        ...document.querySelectorAll("input:not([type=hidden])"),
      ].filter((i) => {
        const id = i.id;
        const aria = i.getAttribute("aria-label");
        const label = id && document.querySelector(`label[for="${id}"]`);
        return !aria && !label && !i.closest("label");
      }).length,
    }));
    step("a11y-landmarks-review", landmarks.nav > 0 && landmarks.main > 0, {
      landmarks,
    });
  }

  // Mobile walkthrough
  await login(mobile);
  step("login-mobile", true);
  await visit(mobile, "/", "m01-overview", []);
  await visit(mobile, "/portfolio", "m02-portfolio", []);
  await visit(mobile, "/portfolio/capacity", "m03-capacity", []);
  await visit(mobile, "/initiatives", "m04-initiatives", []);
  await visit(mobile, "/pi", "m05-pi-list", []);
  if (seed.piId) {
    await visit(mobile, `/pi/${seed.piId}/board`, "m06-pi-board", []);
    await visit(mobile, `/pi/${seed.piId}/compare`, "m07-pi-compare", []);
    await visit(mobile, `/pi/${seed.piId}/review`, "m08-pi-review", []);
  }
  // Open mobile nav
  await mobile.goto(`${base}/`, { waitUntil: "networkidle" });
  const menu = mobile.getByRole("button", { name: /Open navigation|Menu/i });
  if ((await menu.count()) > 0) {
    await menu.click();
    await mobile.waitForTimeout(300);
    await shot(mobile, "m09-nav-open");
    step("mobile-nav-drawer", true);
  } else {
    step("mobile-nav-drawer", false);
  }

  // Role note
  result.notes.push(
    "Browser session uses single temp-auth Organization Admin (owner). Viewer/Dept/Team/Project Manager UI personas NOT VERIFIED in browser — infer from capabilities + role packs.",
  );
} catch (e) {
  step("fatal", false, { error: String(e) });
  await shot(desktop, "fatal-error").catch(() => {});
} finally {
  fs.writeFileSync(
    path.join(outDir, "audit-result.json"),
    JSON.stringify(result, null, 2),
  );
  await browser.close();
  const failed = result.steps.filter((s) => s.status === "FAIL");
  console.log(JSON.stringify(result, null, 2));
  process.exit(failed.length ? 1 : 0);
}
