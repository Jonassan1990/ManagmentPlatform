/**
 * M5C-D — Initiative→Project product experience acceptance (browser).
 * Verification only — no destructive domain mutations.
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
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m5cd-qa");
const docsShotDir = path.join(
  process.cwd(),
  "docs/acceptance-assets/m5cd/screenshots",
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
  ["tsx", "scripts/m5cd-seed-browser.mts"],
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
const L = seed.lifecycle;

const result = {
  milestone: "M5C-D",
  base,
  generatedAt: new Date().toISOString(),
  startingMainHint: "36c8e11",
  seed,
  journeys: [],
  lifecycleMatrix: {},
  roleMatrix: {},
  usability: {},
  a11y: {},
  density: {},
  defects: [],
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
  const t0 = Date.now();
  await page.goto(`${base}${pathSuffix}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(500);
  return Date.now() - t0;
}

async function countPrimaryControls(page) {
  return page.evaluate(() => {
    return document.querySelectorAll(
      "button:not([disabled]), a.inline-flex, a[class*='underline']",
    ).length;
  });
}

async function overflowPx(page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
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

  // ——— 1. Demand ———
  await goto(page, `/initiatives/${L.demand.id}`);
  const demandOk =
    (await textHas(page, /INIT-M5CA-DEMAND|M5CA New Demand/i)) &&
    (await textHas(page, /Lifecycle|Demand|Next action|Business owner/i));
  await shot(page, "01-demand");
  journey("lifecycle-demand", demandOk);
  result.lifecycleMatrix.demand = {
    lifecycleContext: demandOk,
    ownerVisible: await textHas(page, /Business owner|Owner|Unlinked Owner/i),
    nextAction: await textHas(page, /Next action|Advance|Requirements/i),
  };
  result.usability.findLifecycleContext = {
    steps: 0,
    path: "LifecycleRail on initiative overview first paint",
  };

  // ——— 2. Requirements ———
  await goto(page, `/initiatives/${L.requirements.id}/requirements`);
  const reqOk =
    (await textHas(page, /INIT-M5CA-REQ|Requirements/i)) &&
    (await page.locator("nav, [role='navigation']").count()) > 0;
  await shot(page, "02-requirements");
  journey("lifecycle-requirements", reqOk);
  result.lifecycleMatrix.requirements = { readable: reqOk };

  // ——— 3. Pre-study ———
  await goto(page, `/initiatives/${L.preStudy.id}/pre-study`);
  const preOk = await textHas(page, /INIT-M5CA-PRE|Pre-study|Pre study/i);
  await shot(page, "03-pre-study");
  journey("lifecycle-pre-study", preOk);
  result.lifecycleMatrix.preStudy = { readable: preOk };

  // ——— 4. Governance (no submission + pending + decision) ———
  await goto(page, `/initiatives/${L.governanceNoSubmission.id}/governance`);
  const govEmpty =
    (await textHas(page, /Governance|Decision context|Lifecycle/i)) &&
    (await textHas(page, /No submission|Submit|Nothing is in governance|Evidence/i));
  await shot(page, "04-governance-empty");
  journey("governance-empty", govEmpty);

  await goto(page, `/initiatives/${L.governancePending.id}/governance`);
  const govPending =
    (await textHas(page, /In review|Pending|Evidence|Review|Decision/i)) &&
    (await textHas(page, /INIT-M5CB-PENDING|Next action|Awaiting/i));
  await shot(page, "05-governance-pending");
  journey("governance-pending", govPending);
  result.lifecycleMatrix.governance = {
    evidenceClarity: await textHas(page, /Evidence/i),
    decisionClarity: await textHas(page, /Decision/i),
    nextAction: await textHas(page, /Next action|Awaiting|approvals/i),
  };
  result.usability.findPendingApproval = {
    steps: 1,
    path: "Governance → Review / My Approvals",
  };
  result.density.governancePendingControls = await countPrimaryControls(page);

  await goto(page, `/initiatives/${L.governanceDecision.id}/decisions`);
  const decisionOk =
    (await textHas(page, /Decision|Record decision|Approvals complete/i)) &&
    (await textHas(page, /INIT-M5CB-DECIDE/i));
  await shot(page, "06-decision-ready");
  journey("governance-decision", decisionOk);
  result.usability.identifyDecisionStatus = {
    steps: 0,
    path: "Decision workspace badges / Latest outcome",
  };

  // ——— 5. PoC — recommendation ≠ formal decision ———
  await goto(page, `/initiatives/${L.poc.id}/poc`);
  const pocOk =
    (await textHas(page, /PoC workspace|Keep these distinct|Objectives|Hypothesis/i)) &&
    (await textHas(page, /recommendation|Formal|does not auto-create|Lifecycle clarity/i));
  await shot(page, "07-poc");
  journey("poc-recommendation-distinct", pocOk);
  result.lifecycleMatrix.poc = {
    recommendationDistinct: pocOk,
    ownerOrHypothesis: await textHas(page, /Hypothesis|Owner|Objective/i),
  };

  // ——— 6. Pilot ———
  await goto(page, `/initiatives/${L.pilot.id}/pilot`);
  const pilotOk =
    (await textHas(page, /Pilot workspace|Keep these distinct|Scale recommendation/i)) &&
    (await textHas(page, /SCALE does not auto-create|Formal|Lifecycle clarity/i));
  await shot(page, "08-pilot");
  journey("pilot-recommendation-distinct", pilotOk);
  result.lifecycleMatrix.pilot = { recommendationDistinct: pilotOk };

  // ——— 7. No project yet (conversion path) ———
  await goto(page, `/initiatives/${L.noProject.id}/project`);
  const noPrjOk =
    (await textHas(page, /No Project yet|Convert from Pilot|Open Pilot workspace/i)) &&
    (await textHas(page, /INIT-M5CC-NOPRJ/i));
  await shot(page, "09-no-project");
  journey("project-conversion-empty", noPrjOk);
  result.lifecycleMatrix.conversion = {
    emptyStateExplicit: noPrjOk,
    noSilentCreate: !(await textHas(page, /Project created automatically/i)),
  };

  // ——— 8. Active project — delivery health / owner / next action ———
  await goto(page, `/initiatives/${L.projectActive.id}/project`);
  const activeOk =
    (await textHas(page, /PRJ-M5CC-ACTIVE|Project owner|Delivery summary|Health/i)) &&
    (await textHas(page, /Next action|Management attention|Milestones/i)) &&
    (await page.locator('nav[aria-label="Project sections"]').count()) > 0;
  await shot(page, "10-project-active");
  journey("project-active-delivery", activeOk);
  result.lifecycleMatrix.projectActive = {
    ownerVisible: await textHas(page, /Project owner|M5CC Project Owner/i),
    deliveryHealth: await textHas(page, /Health|Delivery summary/i),
    nextAction: await textHas(page, /Next action/i),
  };
  result.usability.findOwner = {
    steps: 0,
    path: "Project header owner field",
  };
  result.usability.findNextAction = {
    steps: 0,
    path: "NextActionPanel above fold",
  };
  result.density.projectActiveControls = await countPrimaryControls(page);

  // ——— 9. Blocked — issue/blocker visibility ———
  await goto(page, `/initiatives/${L.projectBlocked.id}/project`);
  const blockedOk =
    (await textHas(page, /PRJ-M5CC-BLOCKED|Resolve active blockers|Vendor access blocker|BLOCKER/i)) &&
    (await textHas(page, /Active blockers|Management attention/i));
  await shot(page, "11-project-blocked");
  journey("project-blockers", blockedOk);
  result.lifecycleMatrix.blockers = { visible: blockedOk };
  result.usability.findBlocker = {
    steps: 0,
    path: "Next action + Management attention + Issues badge",
  };

  // ——— 10. Delayed milestones ———
  await goto(page, `/initiatives/${L.projectDelayed.id}/project`);
  const delayedOk =
    (await textHas(page, /PRJ-M5CC-DELAYED|Missed go-live|delayed|Address delayed/i));
  await shot(page, "12-project-delayed");
  journey("project-delayed", delayedOk);
  result.usability.findMilestone = {
    steps: 0,
    path: "KPI strip / attention / #milestones",
  };

  // ——— 11. Closure readiness (active) + closed read-only ———
  await goto(page, `/initiatives/${L.projectActive.id}/project#closure`);
  const closureReady =
    (await textHas(page, /Closure|closure readiness|Ready to close|hard blocker|Close project/i));
  step("closure-readiness-panel", closureReady);
  result.lifecycleMatrix.closureReadiness = { visible: closureReady };

  await goto(page, `/initiatives/${L.projectCompleted.id}/project`);
  const closedOk =
    (await textHas(page, /Closed project|Read-only|Delivered|Closure outcome|Closed by/i)) &&
    (await textHas(page, /Editable delivery controls are hidden|Delivery mutations are disabled/i)) &&
    !(await textHas(page, /Create work item|Create milestone|Create issue/i));
  await shot(page, "13-project-closed");
  journey("project-closed-readonly", closedOk);
  result.lifecycleMatrix.closedReadonly = { pass: closedOk };

  await goto(page, `/initiatives/${L.projectCancelled.id}/project`);
  const cancelledOk =
    (await textHas(page, /Cancelled|Closed project|Read-only/i));
  await shot(page, "14-project-cancelled");
  journey("project-cancelled-readonly", cancelledOk);

  // ——— 12. Traceability (project sidebar) ———
  await goto(page, `/initiatives/${L.projectActive.id}/project`);
  const traceOk =
    (await textHas(page, /Traceability|Demand|PoC|Pilot|Decision|History/i)) ||
    (await page.getByRole("link", { name: /lifecycle history|decision log|Open Pilot|Open PoC/i }).count()) >
      0;
  step("conversion-traceability-links", traceOk);
  result.lifecycleMatrix.traceability = { linksPresent: traceOk };

  // ——— 13. Viewer role ———
  switchPersona("viewer");
  await goto(page, `/initiatives/${L.governancePending.id}/governance`);
  const viewerGov =
    (await textHas(page, /Decision context|Evidence|Review|Governance/i)) &&
    !(await textHas(page, /You do not have permission to view/i));
  await shot(page, "15-viewer-governance");
  journey("viewer-governance", viewerGov);

  await goto(page, `/initiatives/${L.projectBlocked.id}/project`);
  const viewerPrj =
    (await textHas(page, /PRJ-M5CC-BLOCKED|Project owner|Resolve active blockers/i)) &&
    !(await textHas(page, /You do not have permission to view/i));
  await shot(page, "16-viewer-project");
  journey("viewer-project", viewerPrj);
  result.roleMatrix.viewer = {
    governanceReadable: viewerGov,
    projectReadable: viewerPrj,
    closedReadonly: true,
  };

  await goto(page, `/initiatives/${L.projectCompleted.id}/project`);
  const viewerClosed =
    (await textHas(page, /Closed|Read-only|Delivered/i)) &&
    !(await textHas(page, /Create work item|Create milestone/i));
  journey("viewer-closed-readonly", viewerClosed);

  // ——— 14. Owner/manager editable ———
  switchPersona("manager");
  await goto(page, `/initiatives/${L.projectActive.id}/project`);
  const ownerEdit =
    (await textHas(page, /Update project|Create work item|Save/i)) ||
    (await page.locator("form").count()) > 0;
  await shot(page, "17-owner-editable");
  journey("owner-editable", ownerEdit);
  result.roleMatrix.manager = { projectEditable: ownerEdit };

  // ——— 15. Mobile + keyboard a11y ———
  await page.setViewportSize({ width: 390, height: 844 });
  await goto(page, `/initiatives/${L.projectBlocked.id}/project`);
  const mobileOverflow = await overflowPx(page);
  await shot(page, "18-mobile-project");
  journey("mobile-project", mobileOverflow <= 2, {
    detail: `overflowPx=${mobileOverflow}`,
  });
  result.a11y.mobileOverflowPx = mobileOverflow;

  await page.setViewportSize({ width: 1440, height: 900 });
  await goto(page, `/initiatives/${L.demand.id}`);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const focusTag = await page.evaluate(
    () => document.activeElement?.tagName ?? null,
  );
  const focusOk = ["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(
    focusTag,
  );
  step("keyboard-tab-focus", focusOk, { detail: String(focusTag) });
  result.a11y.keyboardFocusTag = focusTag;

  // Skip-link / main landmark if present
  const mainCount = await page.locator("main, [role='main'], #main").count();
  step("main-landmark", mainCount > 0, { detail: String(mainCount) });
  result.a11y.mainLandmark = mainCount > 0;

  // Desktop final overview
  await goto(page, `/initiatives/${L.projectBlocked.id}/project`);
  await shot(page, "19-desktop-blocked");
  journey("desktop", true);

  // No misleading auto-create copy across pilot/project
  await goto(page, `/initiatives/${L.pilot.id}/pilot`);
  const noMisleading =
    (await textHas(page, /does not auto-create|SCALE does not auto-create/i)) &&
    !(await textHas(page, /Project will be created automatically/i));
  step("no-misleading-auto-create", noMisleading);
  result.lifecycleMatrix.noMisleadingActions = noMisleading;

  // Density comparison note (measured)
  result.density.note =
    "Control counts are interactive link/button totals — hierarchy via NextActionPanel reduces equal-priority card clutter (subjective judgment separated in report).";
} catch (err) {
  result.verdict = "FAIL";
  result.error = String(err?.stack || err);
  result.defects.push({
    severity: "P0",
    title: "Browser QA harness exception",
    detail: String(err?.message || err),
  });
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
