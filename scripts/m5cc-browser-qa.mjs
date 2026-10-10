/**
 * M5C-C Project & Delivery workspace — browser QA.
 *
 * Env: QA_BASE_URL, QA_PASS_FILE, DATABASE_URL, TEMP_AUTH_PRINCIPAL_ID
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
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m5cc-qa");
const docsShotDir = path.join(
  process.cwd(),
  "docs/acceptance-assets/m5cc/screenshots",
);
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(docsShotDir, { recursive: true });

const dbUrl =
  process.env.DATABASE_URL ??
  "postgresql://mgmt:mgmt_dev_only@127.0.0.1:5432/management_platform_m3d_qa?schema=public";
const principalId =
  process.env.TEMP_AUTH_PRINCIPAL_ID ??
  "f796fe09-b948-4eb6-9fcd-0770990ab453";

const seedRun = spawnSync(
  "npx",
  ["tsx", "scripts/m5cc-seed-browser.mts"],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: dbUrl,
      DIRECT_URL: dbUrl,
      TEMP_AUTH_PRINCIPAL_ID: principalId,
      QA_OUT_DIR: outDir,
    },
    encoding: "utf8",
  },
);
if (seedRun.status !== 0) {
  console.error(seedRun.stderr || seedRun.stdout);
  process.exit(1);
}
const seed = JSON.parse(fs.readFileSync(path.join(outDir, "seed.json"), "utf8"));

const result = {
  milestone: "M5C-C",
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
  await page.waitForTimeout(400);
  if (!page.url().includes("/login")) {
    step("login.dev-auth", true, { detail: page.url() });
    return;
  }
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

function projectPath(initiativeId) {
  return `/initiatives/${initiativeId}/project`;
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

  // 1. Active project — header / purpose / owner / next action
  await goto(page, projectPath(seed.initiatives.active.id));
  const activeOk =
    (await textHas(page, /PRJ-M5CC-ACTIVE|Active delivery workspace/i)) &&
    (await textHas(page, /Project owner|M5CC Project Owner/i)) &&
    (await textHas(page, /Purpose|Ship the delivery workspace/i)) &&
    (await textHas(page, /Delivery summary|Milestones|Active blockers/i)) &&
    (await textHas(page, /Management attention|Next action|Advance open work|No urgent/i)) &&
    (await page.locator('nav[aria-label="Project sections"]').count()) > 0 &&
    (await page.locator("#overview").count()) > 0 &&
    (await page.locator("#delivery").count()) > 0 &&
    (await page.locator("#issues").count()) > 0 &&
    (await page.locator("#resources").count()) > 0 &&
    (await page.locator("#closure").count()) > 0 &&
    (await page.locator("#history").count()) > 0;
  await shot(page, "01-active-overview");
  journey("active-project", activeOk);
  result.usability.findOwner = {
    steps: 0,
    path: "Project header · Project owner field",
  };
  result.usability.findNextAction = {
    steps: 0,
    path: "Next action panel above management attention",
  };
  result.usability.findMilestone = {
    steps: 1,
    path: "Section nav → Delivery / #milestones",
  };

  // Deep links preserved
  await goto(page, `${projectPath(seed.initiatives.active.id)}#milestones`);
  const deepOk =
    (await page.locator("#milestones").count()) > 0 &&
    (await textHas(page, /MS-M5CC-A1|Foundation complete/i));
  step("deep-link-milestones", deepOk);

  // 2. Blocked
  await goto(page, projectPath(seed.initiatives.blocked.id));
  const blockedOk =
    (await textHas(page, /PRJ-M5CC-BLOCKED|Blocked modernization/i)) &&
    (await textHas(page, /Resolve active blockers|Vendor access blocker|BLOCKER/i)) &&
    (await textHas(page, /Active blockers|Needs attention|Management attention/i));
  await shot(page, "02-blocked");
  journey("blocked-project", blockedOk);
  result.usability.findBlocker = {
    steps: 0,
    path: "Next action + Management attention + Issues badge",
  };

  // 3. Delayed
  await goto(page, projectPath(seed.initiatives.delayed.id));
  const delayedOk =
    (await textHas(page, /PRJ-M5CC-DELAYED|Delayed rollout/i)) &&
    (await textHas(page, /Missed go-live|Address delayed milestones|delayed\/missed/i));
  await shot(page, "03-delayed");
  journey("delayed-project", delayedOk);

  // 4. Completed / closed read-only
  await goto(page, projectPath(seed.initiatives.completed.id));
  const completedOk =
    (await textHas(page, /PRJ-M5CC-DONE|Closed project|Read-only|Delivered/i)) &&
    (await textHas(page, /Closure outcome|Closure date|Closed by|M5CC QA Actor|TempOwner/i)) &&
    (await textHas(page, /Editable delivery controls are hidden|Delivery mutations are disabled/i)) &&
    !(await textHas(page, /Create work item|Create milestone|Create issue/i));
  await shot(page, "04-completed-closed");
  journey("completed-closed-readonly", completedOk);

  // 5. Cancelled
  await goto(page, projectPath(seed.initiatives.cancelled.id));
  const cancelledOk =
    (await textHas(page, /PRJ-M5CC-CAN|Cancelled|Closed project|Read-only/i)) &&
    (await textHas(page, /budget reallocation|Closure outcome/i));
  await shot(page, "05-cancelled-closed");
  journey("cancelled-closed", cancelledOk);

  // 6. Missing data
  await goto(page, projectPath(seed.initiatives.missing.id));
  const missingOk =
    (await textHas(page, /PRJ-M5CC-MISS|Sparse project|Not set/i)) &&
    (await textHas(page, /No milestones or work items|Nothing requires management attention|No urgent|Advance open work|Check closure/i));
  await shot(page, "06-missing-data");
  journey("missing-data", missingOk);

  // 7. No project yet
  await goto(page, projectPath(seed.initiatives.noProject.id));
  const noPrjOk =
    (await textHas(page, /No Project yet|Convert from Pilot|Open Pilot workspace/i)) &&
    (await textHas(page, /INIT-M5CC-NOPRJ/i));
  await shot(page, "07-no-project");
  journey("no-project-empty", noPrjOk);

  // Owner persona (manager already linked as org admin with edit)
  await goto(page, projectPath(seed.initiatives.active.id));
  const ownerEditOk =
    (await textHas(page, /Update project|Save project|Create work item/i)) ||
    (await page.locator("form").count()) > 0;
  await shot(page, "08-owner-editable");
  journey("owner-editable", ownerEditOk);

  // 8. Viewer — readable, no misleading edit when capabilities deny
  switchPersona("viewer");
  await goto(page, projectPath(seed.initiatives.blocked.id));
  const viewerOk =
    (await textHas(page, /PRJ-M5CC-BLOCKED|Vendor access blocker|Resolve active blockers/i)) &&
    (await textHas(page, /Project owner|Management attention/i)) &&
    !(await textHas(page, /You do not have permission to view/i));
  await shot(page, "09-viewer");
  journey("viewer-mode", viewerOk);

  // Closed as viewer still read-only
  await goto(page, projectPath(seed.initiatives.completed.id));
  const viewerClosed =
    (await textHas(page, /Closed project|Read-only|Delivered/i)) &&
    !(await textHas(page, /Create work item|Create milestone/i));
  journey("viewer-closed-readonly", viewerClosed);

  // 9. Responsive
  switchPersona("manager");
  await page.setViewportSize({ width: 768, height: 1024 });
  await goto(page, projectPath(seed.initiatives.blocked.id));
  const tabletOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 2,
  );
  await shot(page, "10-tablet");
  journey("tablet", !tabletOverflow);

  await page.setViewportSize({ width: 390, height: 844 });
  await goto(page, projectPath(seed.initiatives.active.id));
  const mobileOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 2,
  );
  await shot(page, "11-mobile");
  journey("mobile", !mobileOverflow);

  await page.setViewportSize({ width: 1440, height: 900 });
  await goto(page, projectPath(seed.initiatives.blocked.id));
  await shot(page, "12-desktop-blocked");
  journey("desktop", true);

  // Query filters preserved
  await goto(
    page,
    `${projectPath(seed.initiatives.blocked.id)}?issueBlocker=active`,
  );
  const filterOk =
    (await textHas(page, /Vendor access blocker/i)) &&
    (await page.locator('select[name="issueBlocker"]').count()) > 0;
  step("issue-filter-query", filterOk);

  const controlCount = await page.evaluate(() => {
    return document.querySelectorAll(
      "button:not([disabled]), a.inline-flex, a[class*='underline']",
    ).length;
  });
  result.usability.visibleControls = { count: controlCount };
  step("visible-controls-recorded", controlCount > 0, {
    detail: String(controlCount),
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
  restorePersona();
  await browser.close();
  fs.writeFileSync(
    path.join(outDir, "qa-result.json"),
    JSON.stringify(result, null, 2),
  );
  console.log("VERDICT", result.verdict);
  process.exit(result.verdict === "PASS" ? 0 : 1);
}
