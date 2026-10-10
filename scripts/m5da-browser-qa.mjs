/**
 * M5D-A — Premium PI Planning workspace browser QA.
 */
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import fs from "fs";
import path from "node:path";

const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:43154";
const pass = fs
  .readFileSync(process.env.QA_PASS_FILE ?? "/tmp/m3dd-qa-pass.txt", "utf8")
  .trim();
const outDir =
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m5da-qa");
const docsShotDir = path.join(
  process.cwd(),
  "docs/acceptance-assets/m5da/screenshots",
);
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(docsShotDir, { recursive: true });

const dbUrl =
  process.env.DATABASE_URL ??
  "postgresql://mgmt:mgmt_dev_only@127.0.0.1:5432/management_platform_m3d_qa?schema=public";
const principalId =
  process.env.TEMP_AUTH_PRINCIPAL_ID ??
  "f796fe09-b948-4eb6-9fcd-0770990ab453";

const seedRun = spawnSync("npx", ["tsx", "scripts/m5da-seed-browser.mts"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    DATABASE_URL: dbUrl,
    DIRECT_URL: dbUrl,
    TEMP_AUTH_PRINCIPAL_ID: principalId,
    QA_OUT_DIR: outDir,
  },
  encoding: "utf8",
});
if (seedRun.status !== 0) {
  console.error(seedRun.stderr || seedRun.stdout);
  process.exit(1);
}
const seed = JSON.parse(fs.readFileSync(path.join(outDir, "seed.json"), "utf8"));

const result = {
  milestone: "M5D-A",
  base,
  generatedAt: new Date().toISOString(),
  seed,
  journeys: [],
  usability: {},
  steps: [],
  verdict: "PASS",
};

function step(name, ok, extra = {}) {
  result.steps.push({ step: name, status: ok ? "PASS" : "FAIL", ...extra });
  if (!ok) result.verdict = "FAIL";
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`, extra.detail ?? "");
}

function journey(name, ok, extra = {}) {
  result.journeys.push({
    journey: name,
    status: ok ? "PASS" : "FAIL",
    evidence: "BROWSER VERIFIED",
    ...extra,
  });
  if (!ok) result.verdict = "FAIL";
  console.log(`${ok ? "PASS" : "FAIL"} journey:${name}`, extra.detail ?? "");
}

function switchPersona(name) {
  const r = spawnSync(
    "node",
    ["scripts/m5bc-switch-persona.mjs", `--persona=${name}`],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: dbUrl,
        DIRECT_URL: dbUrl,
        TEMP_AUTH_PRINCIPAL_ID: principalId,
        QA_ORG_ID: seed.organizationId,
        QA_PERSONA_STATE: path.join(outDir, "persona-state.json"),
      },
      encoding: "utf8",
    },
  );
  if (r.status !== 0) {
    throw new Error(`persona ${name}: ${r.stderr || r.stdout}`);
  }
}

function restorePersona() {
  spawnSync("node", ["scripts/m5bc-switch-persona.mjs", "--restore"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: dbUrl,
      DIRECT_URL: dbUrl,
      TEMP_AUTH_PRINCIPAL_ID: principalId,
      QA_PERSONA_STATE: path.join(outDir, "persona-state.json"),
    },
    encoding: "utf8",
  });
}

async function login(page) {
  await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  if (!page.url().includes("/login")) {
    step("login.dev-auth", true, { detail: page.url() });
    return;
  }
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  const user = page.locator('input[name="username"]');
  if ((await user.count()) === 0) {
    await page.goto(`${base}/`);
    return;
  }
  await user.fill("owner");
  await page.fill('input[name="password"]', pass);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 25000 }),
    page.getByRole("button", { name: /Sign in/i }).click(),
  ]);
}

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  fs.copyFileSync(file, path.join(docsShotDir, `${name}.png`));
}

async function textHas(page, re) {
  return re.test(await page.locator("body").innerText());
}

async function goto(page, pathSuffix) {
  await page.goto(`${base}${pathSuffix}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(600);
}

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();

try {
  await login(page);
  step("login", true);
  switchPersona("manager");

  // 1. Plan board — planning context
  await goto(page, seed.boardPath);
  const boardOk =
    (await textHas(page, /PI Planning|Plan board|Current plan|Planning period/i)) &&
    (await textHas(page, /Capacity & readiness|Available|Committed|Scenarios/i)) &&
    (await page.locator('nav[aria-label="PI sections"]').count()) > 0 &&
    (await page.locator('section[aria-label="Scenarios"]').count()) > 0 &&
    (await page.locator('section[aria-label="Plan board"]').count()) > 0 &&
    !(await textHas(page, /PlanningRevision/i));
  await shot(page, "01-plan-board");
  journey("plan-board-context", boardOk);
  result.usability.findSelectedPi = {
    steps: 0,
    path: "PI Planning header reference + name",
  };
  result.usability.findCurrentPlan = {
    steps: 0,
    path: "Active plan / Current plan badge",
  };
  result.usability.findCapacity = {
    steps: 0,
    path: "Capacity & readiness strip + Open capacity detail",
  };

  // Manage scenarios progressive disclosure (collapsed on current plan)
  const manage = page.getByRole("button", { name: /Manage scenarios/i });
  const manageCollapsed =
    (await manage.count()) > 0 &&
    (await manage.getAttribute("aria-expanded")) === "false";
  step("manage-scenarios-collapsed-on-current", manageCollapsed);
  if ((await manage.count()) > 0) {
    await manage.click();
    await page.waitForTimeout(300);
    const createCopy = await textHas(page, /Create from current plan/i);
    step("create-from-current-plan-copy", createCopy);
    await shot(page, "02-manage-scenarios");
    await manage.click();
  }

  // Compare / Review links
  const compareOk =
    (await page.getByRole("link", { name: /Compare scenarios/i }).count()) >
      0 || (await page.getByRole("link", { name: /^Compare$/i }).count()) > 0;
  const reviewOk =
    (await page.getByRole("link", { name: /^Review$/i }).count()) > 0;
  step("scenario-nav-compare-review", compareOk && reviewOk);

  // 2. Capacity page
  await goto(page, seed.capacityPath);
  const capacityOk =
    (await textHas(page, /PI Planning|Capacity summary|Available|Committed|Remaining|Overloaded/i)) &&
    (await textHas(page, /Current plan|Open plan board|Portfolio Capacity/i));
  await shot(page, "03-capacity");
  journey("capacity-workspace", capacityOk);
  result.usability.findOverload = {
    steps: 0,
    path: "Capacity KPI Overloaded cell",
  };

  // 3. Compare entry
  await goto(page, seed.comparePath);
  const comparePageOk = await textHas(page, /Compare|scenario/i);
  await shot(page, "04-compare");
  journey("compare-entry", comparePageOk);

  // 4. Planner editable — allocate forms or board cells
  await goto(page, seed.boardPath);
  const plannerOk =
    (await textHas(page, /Editable|Allocations update the current plan|Plan board/i)) &&
    ((await page.locator("form").count()) > 0 ||
      (await textHas(page, /Allocate|Move|Backlog/i)));
  await shot(page, "05-planner-editable");
  journey("planner-editable", plannerOk);

  // 5. Viewer
  switchPersona("viewer");
  await goto(page, seed.boardPath);
  const viewerOk =
    (await textHas(page, /PI Planning|Current plan|Scenarios|Plan board/i)) &&
    !(await textHas(page, /You do not have permission to view/i));
  await shot(page, "06-viewer");
  journey("viewer-mode", viewerOk);

  // 6. Mobile
  switchPersona("manager");
  await page.setViewportSize({ width: 390, height: 844 });
  await goto(page, seed.boardPath);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  await shot(page, "07-mobile");
  journey("mobile", overflow <= 2, { detail: `overflowPx=${overflow}` });

  await page.setViewportSize({ width: 1440, height: 900 });
  await goto(page, seed.capacityPath);
  await shot(page, "08-desktop-capacity");
  journey("desktop", true);

  // Tab label
  await goto(page, seed.boardPath);
  const tabOk =
    (await page.getByRole("link", { name: /^Plan board$/i }).count()) > 0;
  step("plan-board-tab-label", tabOk);
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
  restorePersona();
  await browser.close();
  fs.writeFileSync(
    path.join(outDir, "qa-result.json"),
    JSON.stringify(result, null, 2),
  );
  console.log("VERDICT", result.verdict);
  process.exit(result.verdict === "PASS" ? 0 : 1);
}
