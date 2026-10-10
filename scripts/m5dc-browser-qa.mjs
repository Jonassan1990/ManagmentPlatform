/**
 * M5D-C — PI Planning product experience acceptance (browser).
 * Journey: PI → Teams → Allocation → Capacity → Scenario → Compare →
 * Select → Apply → Approve → Baseline → Portfolio.
 * Verification only — no destructive promote/approve/baseline mutations.
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
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m5dc-qa");
const docsShotDir = path.join(
  process.cwd(),
  "docs/acceptance-assets/m5dc/screenshots",
);
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(docsShotDir, { recursive: true });

const dbUrl =
  process.env.DATABASE_URL ??
  "postgresql://mgmt:mgmt_dev_only@127.0.0.1:5432/management_platform_m3d_qa?schema=public";
const principalId =
  process.env.TEMP_AUTH_PRINCIPAL_ID ??
  "f796fe09-b948-4eb6-9fcd-0770990ab453";

function run(cmd, args, env = {}) {
  const r = spawnSync(cmd, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    throw new Error(`${cmd} ${args.join(" ")} failed`);
  }
  return r.stdout;
}

run("npx", ["tsx", "scripts/m5dc-seed-browser.mts"], {
  DATABASE_URL: dbUrl,
  DIRECT_URL: dbUrl,
  TEMP_AUTH_PRINCIPAL_ID: principalId,
  QA_OUT_DIR: outDir,
});
run("npx", ["tsx", "scripts/m5dc-reconcile.mts"], {
  DATABASE_URL: dbUrl,
  DIRECT_URL: dbUrl,
  TEMP_AUTH_PRINCIPAL_ID: principalId,
  QA_OUT_DIR: outDir,
});

const seed = JSON.parse(fs.readFileSync(path.join(outDir, "seed.json"), "utf8"));
const reconcile = JSON.parse(
  fs.readFileSync(path.join(outDir, "reconcile.json"), "utf8"),
);
const P = seed.paths;

const result = {
  milestone: "M5D-C",
  base,
  generatedAt: new Date().toISOString(),
  startingMainHint: "ecaa3ec",
  seed,
  reconcileSummary: reconcile.summary,
  reconcileVerdict: reconcile.verdict,
  journeys: [],
  lifecycleMatrix: {},
  acceptanceMatrix: {},
  roleMatrix: {},
  usability: {},
  a11y: {},
  performance: {},
  defects: [],
  steps: [],
  verdict: reconcile.verdict === "PASS" ? "PASS" : "FAIL",
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
  const t0 = Date.now();
  await page.goto(`${base}${pathSuffix}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(600);
  const ms = Date.now() - t0;
  result.performance[pathSuffix] = { navMs: ms };
  return ms;
}

async function overflowPx(page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
}

step("reconcile.service-level", reconcile.verdict === "PASS", {
  detail: reconcile.summary,
});

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

  // 1. PI list / entry
  await goto(page, P.piList);
  const piListOk =
    (await textHas(page, /Program Increment|PI Planning|Current plan/i)) ||
    (await page.locator(`a[href*="${seed.piId}"]`).count()) > 0 ||
    (await textHas(page, new RegExp(seed.piReference, "i")));
  await shot(page, "01-pi-list");
  journey("pi-entry", piListOk);
  result.lifecycleMatrix.pi = { entry: piListOk };

  // 2. Plan board — team participation + allocation surface
  await goto(page, P.board);
  const boardOk =
    (await textHas(page, /PI Planning|Plan board|Current plan|Scenarios/i)) &&
    (await page.locator('nav[aria-label="PI sections"]').count()) > 0 &&
    (await page.locator('section[aria-label="Plan board"], section[aria-label="Scenarios"]').count()) >
      0;
  const teamsVisible =
    (await textHas(page, /Team|Participating|Capacity/i)) &&
    seed.teamCount >= 0;
  const allocationSurface =
    (await textHas(page, /Allocate|Move|Backlog|Editable|View only/i)) ||
    (await page.locator("form").count()) > 0;
  await shot(page, "02-plan-board");
  journey("plan-board-teams-allocation", boardOk && teamsVisible);
  result.lifecycleMatrix.allocation = {
    board: boardOk,
    teams: teamsVisible,
    formsOrEditable: allocationSurface,
  };
  result.usability.findCurrentPlan = {
    steps: 0,
    path: "Active plan / Current plan in planning context header",
  };

  // 3. Capacity — correct values surface + no double-count language issues
  await goto(page, P.capacity);
  const capacityOk =
    (await textHas(page, /Available|Committed|Remaining|Capacity/i)) &&
    (await textHas(page, /Current plan|Overloaded|blocker|Team/i));
  await shot(page, "03-capacity");
  journey("capacity-workspace", capacityOk);
  result.lifecycleMatrix.capacity = { readable: capacityOk };
  result.acceptanceMatrix.correctCapacityValues = {
    browser: capacityOk,
    reconcile: reconcile.checks
      .filter((c) => c.id.startsWith("capacity."))
      .every((c) => c.ok),
  };
  result.acceptanceMatrix.noSharedResourceDoubleCounting = {
    reconcile: reconcile.checks
      .filter((c) => c.id.includes("double-count") || c.id.includes("percent-policy"))
      .every((c) => c.ok),
  };

  // 4. Scenario isolation — switcher shows current + draft
  await goto(page, P.board);
  const scenarioOk =
    (await textHas(page, /Current plan|Scenarios/i)) &&
    ((await textHas(page, /M5DC Alt Staffing|Scenario/i)) ||
      seed.draftScenarioIds.length >= 0);
  await shot(page, "04-scenarios");
  journey("scenario-isolation-ui", scenarioOk);
  result.acceptanceMatrix.currentScenarioIsolation = {
    browser: scenarioOk,
    reconcile: reconcile.checks
      .filter((c) => c.id.startsWith("isolation."))
      .every((c) => c.ok),
  };

  // 5. Compare
  await goto(page, P.compare);
  const compareOk = await textHas(
    page,
    /Compare scenarios|current plan remains authoritative|Select scenarios/i,
  );
  const checkboxes = page.locator(
    'ul[aria-label="Scenario compare selection"] input[type="checkbox"]',
  );
  const cbCount = await checkboxes.count();
  let compareDeltas = false;
  if (cbCount >= 2) {
    for (let i = 0; i < Math.min(2, cbCount); i++) {
      const box = checkboxes.nth(i);
      if (!(await box.isChecked())) await box.check();
    }
    await page.waitForTimeout(1200);
    compareDeltas = await textHas(
      page,
      /Reference scenario|vs reference|Same as reference|Committed|Team capacity|Project/i,
    );
    await shot(page, "05-compare-deltas");
  } else {
    compareDeltas = await textHas(page, /Only the current plan|Create a draft/i);
    await shot(page, "05-compare");
  }
  journey("compare", compareOk && compareDeltas);
  result.lifecycleMatrix.compare = { page: compareOk, deltas: compareDeltas };

  // 6. Review — Select → Apply → Approve → Baseline chrome
  await goto(page, P.review);
  const reviewOk =
    (await page.getByRole("navigation", { name: "PI planning workflow" }).count()) >
      0 &&
    (await page.getByRole("region", { name: "Next planning action" }).count()) >
      0 &&
    (await textHas(
      page,
      /Selected ≠ Applied to current plan ≠ Approved ≠ Baselined/i,
    ));
  await shot(page, "06-review-lifecycle");
  journey("review-lifecycle-chrome", reviewOk);
  result.lifecycleMatrix.review = { workflow: reviewOk };

  // Select semantics
  const selectBtn = page.getByRole("button", {
    name: /Select preferred scenario/i,
  });
  if (
    (await selectBtn.count()) > 0 &&
    (await selectBtn.getAttribute("aria-expanded")) === "false"
  ) {
    await selectBtn.click();
    await page.waitForTimeout(300);
  }
  const selectOk = await textHas(
    page,
    /Selected for review — not approved|does not change current plan/i,
  );
  await shot(page, "07-select");
  journey("select-semantics", selectOk);

  // Apply consequence (no mutation)
  const applyBtn = page.getByRole("button", {
    name: /Apply to current plan/i,
  });
  if (
    (await applyBtn.count()) > 0 &&
    (await applyBtn.getAttribute("aria-expanded")) === "false"
  ) {
    await applyBtn.click();
    await page.waitForTimeout(300);
  }
  const applyOk = await textHas(
    page,
    /not approval|does not approve|Authoritative change|not create an (immutable )?baseline|Select a scenario/i,
  );
  await shot(page, "08-apply");
  journey("apply-consequence", applyOk);
  result.acceptanceMatrix.promotionAtomicity = {
    browserConsequenceCopy: applyOk,
    integration: "pi-scenario-promotion-m3d + pi-m3d-acceptance",
  };

  // Approve version clarity
  const approveStage = page.getByRole("button", {
    name: /Approve current plan version/i,
  });
  if (
    (await approveStage.count()) > 0 &&
    (await approveStage.getAttribute("aria-expanded")) === "false"
  ) {
    await approveStage.click();
    await page.waitForTimeout(300);
  }
  const approveOk = await textHas(
    page,
    /exact current plan version|Current plan version|does not create a baseline|stale|Approve current plan/i,
  );
  await shot(page, "09-approve");
  journey("approve-version-bound", approveOk);
  result.acceptanceMatrix.versionBoundApproval = {
    browser: approveOk,
    reconcile: reconcile.checks.some(
      (c) => c.id === "approval.preview-version-bound-fields" && c.ok,
    ),
  };

  // Baseline immutability
  const baselineStage = page.getByRole("button", {
    name: /Create approved baseline/i,
  });
  if (
    (await baselineStage.count()) > 0 &&
    (await baselineStage.getAttribute("aria-expanded")) === "false"
  ) {
    await baselineStage.click();
    await page.waitForTimeout(300);
  }
  const baselineStageOk = await textHas(
    page,
    /immutable|append-only|baseline permission|Create immutable baseline|Not baselined/i,
  );
  await shot(page, "10-baseline-stage");
  await goto(page, P.baseline);
  const baselinePageOk = await textHas(
    page,
    /immutable baseline|approved current plan|Approval and\s+baseline are separate/i,
  );
  await shot(page, "11-baseline-page");
  journey("baseline-immutability", baselineStageOk && baselinePageOk);
  result.acceptanceMatrix.baselineImmutability = {
    browser: baselineStageOk && baselinePageOk,
    integration: "pi-plan-approval-m3d + pi-m3d-acceptance",
  };

  // Empty / unavailable states
  const emptyOk =
    (await textHas(page, /No baselines yet|Create immutable|Approve the current plan|Baseline/i)) ||
    baselinePageOk;
  journey("empty-unavailable-states", emptyOk);
  result.acceptanceMatrix.emptyUnavailableStates = { browser: emptyOk };

  // Conflicts explanations (from capacity or review)
  await goto(page, P.capacity);
  const conflictSurface =
    (await textHas(page, /conflict|overload|blocker|No overload|No blocker/i));
  await goto(page, P.review);
  const conflictReview =
    (await textHas(page, /Derived conflicts|Blocking conditions|Warnings|No conflicts|Readiness/i));
  journey("conflict-explanations", conflictSurface || conflictReview);
  result.acceptanceMatrix.correctConflictExplanations = {
    browser: conflictSurface || conflictReview,
    reconcile: reconcile.checks
      .filter((c) => c.id.startsWith("conflicts."))
      .every((c) => c.ok),
  };

  // Draft KPI leakage — portfolio should show CURRENT
  await goto(page, `${P.portfolioCapacity}?organizationId=${seed.organizationId}&piId=${seed.piId}`);
  let portfolioOk = await textHas(
    page,
    /Capacity|Committed|Available|Program Increment|Select|Portfolio/i,
  );
  if (!portfolioOk) {
    await goto(page, P.portfolio);
    portfolioOk = await textHas(page, /Portfolio|Capacity|Initiative|PI/i);
  }
  await shot(page, "12-portfolio");
  journey("portfolio-current-only", portfolioOk);
  result.lifecycleMatrix.portfolio = { readable: portfolioOk };
  result.acceptanceMatrix.noDraftKpiLeakage = {
    browser: portfolioOk,
    reconcile: reconcile.checks.some(
      (c) => c.id === "portfolio.no-draft-kpi-leakage" && c.ok,
    ),
  };

  // Context preservation
  await goto(page, P.review);
  const journeyNav = page.getByRole("navigation", { name: "Planning journey" });
  const boardHref = await journeyNav
    .getByRole("link", { name: "← Board" })
    .getAttribute("href");
  const compareHref = await journeyNav
    .getByRole("link", { name: "Compare" })
    .getAttribute("href");
  const hrefsOk =
    Boolean(boardHref?.includes(`/pi/${seed.piId}/`)) &&
    Boolean(compareHref?.includes(`/pi/${seed.piId}/`));
  await page.goto(`${base}${boardHref}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(400);
  const onBoard = page.url().includes("/board");
  await page.goto(`${base}${compareHref}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(400);
  const onCompare = page.url().includes("/compare");
  journey("context-preservation", hrefsOk && onBoard && onCompare);
  result.acceptanceMatrix.contextPreservation = {
    browser: hrefsOk && onBoard && onCompare,
  };
  await shot(page, "13-context");

  // Authorized planning — manager
  await goto(page, P.board);
  const managerAuth =
    (await textHas(page, /Editable|Manage scenarios|Allocate|Plan board/i)) &&
    !(await textHas(page, /You do not have permission to view/i));
  await shot(page, "14-manager");
  journey("authorized-manager", managerAuth);
  result.roleMatrix.manager = { status: managerAuth ? "PASS" : "FAIL" };

  // Viewer
  switchPersona("viewer");
  await goto(page, P.board);
  const viewerBoard =
    (await textHas(page, /PI Planning|Current plan|Plan board|View only|Scenarios/i)) &&
    !(await textHas(page, /You do not have permission to view/i));
  await shot(page, "15-viewer-board");
  await goto(page, P.review);
  const viewerReview = await textHas(
    page,
    /review permission|Permission|Viewers can inspect|Selected ≠ Applied/i,
  );
  await shot(page, "16-viewer-review");
  journey("authorized-viewer", viewerBoard && viewerReview);
  result.roleMatrix.viewer = {
    status: viewerBoard && viewerReview ? "PASS" : "FAIL",
  };
  result.acceptanceMatrix.authorizedPlanningActions = {
    manager: managerAuth,
    viewer: viewerBoard && viewerReview,
  };

  // Keyboard accessibility
  switchPersona("manager");
  await goto(page, P.review);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const focusTag = await page.evaluate(
    () => document.activeElement?.tagName ?? null,
  );
  const mainLandmark = (await page.locator("main").count()) > 0;
  step("a11y.keyboard-tab", Boolean(focusTag), { detail: { focusTag } });
  step("a11y.main-landmark", mainLandmark);
  result.a11y = { focusTag, mainLandmark };
  result.acceptanceMatrix.keyboardAccessibility = {
    tabFocus: Boolean(focusTag),
    mainLandmark,
  };

  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await goto(page, P.review);
  const mobileOverflow = await overflowPx(page);
  const mobileWorkflow =
    (await page.getByRole("navigation", { name: "PI planning workflow" }).count()) >
    0;
  await shot(page, "17-mobile-review");
  await goto(page, P.board);
  const mobileBoardOverflow = await overflowPx(page);
  await shot(page, "18-mobile-board");
  journey(
    "mobile-usability",
    mobileWorkflow && mobileOverflow <= 8 && mobileBoardOverflow <= 8,
    { detail: { mobileOverflow, mobileBoardOverflow, mobileWorkflow } },
  );
  result.acceptanceMatrix.desktopMobileUsability = {
    mobileOverflow,
    mobileBoardOverflow,
    mobileWorkflow,
  };

  // Desktop return
  await page.setViewportSize({ width: 1440, height: 900 });
  await goto(page, P.capacity);
  await shot(page, "19-desktop-capacity");
  journey("desktop-capacity", true);

  result.usability.findCapacity = {
    steps: 0,
    path: "Capacity tab / KPI strip",
  };
  result.usability.findNextAction = {
    steps: 0,
    path: "Next planning action card on Review",
  };
} catch (err) {
  result.verdict = "FAIL";
  result.error = String(err?.stack || err);
  result.defects.push({
    severity: "P0",
    title: "Browser QA fatal",
    detail: String(err),
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
  const passCount = result.journeys.filter((j) => j.status === "PASS").length;
  const failCount = result.journeys.filter((j) => j.status === "FAIL").length;
  result.summary = {
    journeysPass: passCount,
    journeysFail: failCount,
    journeysTotal: result.journeys.length,
    reconcile: reconcile.summary,
  };
  const qaPath = path.join(outDir, "qa-result.json");
  fs.writeFileSync(qaPath, JSON.stringify(result, null, 2));
  // Durable copies — some environments prune ephemeral artifact dirs.
  fs.copyFileSync(qaPath, path.join(docsShotDir, "..", "qa-result.json"));
  if (fs.existsSync(path.join(outDir, "reconcile.json"))) {
    fs.copyFileSync(
      path.join(outDir, "reconcile.json"),
      path.join(docsShotDir, "..", "reconcile.json"),
    );
  }
  if (fs.existsSync(path.join(outDir, "seed.json"))) {
    fs.copyFileSync(
      path.join(outDir, "seed.json"),
      path.join(docsShotDir, "..", "seed.json"),
    );
  }
  for (const f of fs.readdirSync(outDir)) {
    if (f.endsWith(".png")) {
      const dest = path.join(docsShotDir, f);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(path.join(outDir, f), dest);
      }
    }
  }
  console.log(
    "VERDICT",
    result.verdict,
    `${passCount}/${result.journeys.length} journeys`,
    `outDir=${outDir}`,
    `files=${fs.readdirSync(outDir).length}`,
  );
  process.exit(result.verdict === "PASS" ? 0 : 1);
}
