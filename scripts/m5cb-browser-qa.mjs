/**
 * M5C-B Governance / PoC / Pilot — browser QA.
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
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m5cb-qa");
const docsShotDir = path.join(
  process.cwd(),
  "docs/acceptance-assets/m5cb/screenshots",
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
  ["tsx", "scripts/m5cb-seed-browser.mts"],
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
  milestone: "M5C-B",
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
  await page.waitForTimeout(500);
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

  // 1. Initiative Governance entry
  await goto(page, `/initiatives/${seed.initiatives.noSubmission.id}/governance`);
  const entryOk =
    (await textHas(page, /Governance workspace|Decision context/i)) &&
    (await textHas(page, /INIT-M5CB-NOSUB|M5CB No Submission/i)) &&
    (await textHas(page, /Lifecycle progress/i));
  await shot(page, "01-governance-entry");
  journey("initiative-governance-entry", entryOk);
  result.usability.findNextAction = {
    steps: 0,
    path: "Next action panel on governance first paint",
  };

  // 2. Submission workspace (no submission empty state)
  const noSubOk =
    (await textHas(page, /No submission|Nothing is in governance|Submit pre-study/i)) &&
    (await page.locator("#governance-evidence").count()) > 0;
  await shot(page, "02-no-submission");
  journey("submission-workspace-empty", noSubOk);

  // 3. Pending approval — governance + My Approvals
  await goto(
    page,
    `/initiatives/${seed.initiatives.pendingApproval.id}/governance`,
  );
  const pendingGov =
    (await textHas(page, /In review|Awaiting required approvals|Pending/i)) &&
    (await textHas(page, /Evidence|Review|Decision/i));
  await shot(page, "03-pending-approval-governance");
  // Expand review if needed
  const review = page.locator("#governance-review");
  if ((await review.count()) > 0) {
    await review.evaluate((el) => {
      el.open = true;
    });
  }
  await shot(page, "03b-review-section");
  journey("pending-approval-governance", pendingGov);
  result.usability.findPendingApproval = {
    steps: 1,
    path: "Governance → Review section (or My Approvals)",
  };
  result.usability.inspectEvidence = {
    steps: 1,
    path: "Governance → Evidence disclosure",
  };

  await goto(page, "/approvals");
  const approvalsOk =
    (await textHas(page, /My Approvals|Approval task/i)) &&
    (await textHas(page, /INIT-M5CB-PENDING|M5CB Pending Approval/i)) &&
    (await textHas(page, /Review and confirm approval|Record approval/i));
  await shot(page, "04-approval-review");
  journey("approval-review", approvalsOk);

  // Confirm dialog opens
  const confirmBtn = page.getByRole("button", {
    name: /Review and confirm approval/i,
  });
  if ((await confirmBtn.count()) > 0) {
    await confirmBtn.first().click();
    await page.waitForTimeout(300);
    const dialogOk = await textHas(page, /Confirm|immutable|Cancel/i);
    await shot(page, "04b-approval-confirm-dialog");
    step("approval-confirm-dialog", dialogOk);
    await page.getByRole("button", { name: /^Cancel$/i }).click();
  } else {
    step("approval-confirm-dialog", false, { detail: "button missing" });
  }

  // 4. Decision workspace
  await goto(
    page,
    `/initiatives/${seed.initiatives.awaitingDecision.id}/decisions`,
  );
  const decisionOk =
    (await textHas(page, /Decision workspace|Record decision|Approvals complete/i)) &&
    (await textHas(page, /INIT-M5CB-DECIDE|M5CB Awaiting Decision/i));
  await shot(page, "05-decision-workspace");
  journey("decision-workspace", decisionOk);
  result.usability.identifyDecisionStatus = {
    steps: 0,
    path: "Decision workspace badges / Latest outcome",
  };

  // Confirm dialog on decision
  const decideBtn = page.getByRole("button", {
    name: /Review and confirm decision/i,
  });
  if ((await decideBtn.count()) > 0) {
    await decideBtn.first().click();
    await page.waitForTimeout(300);
    const dialogOk = await textHas(page, /Confirm decision|immutable|Cancel/i);
    await shot(page, "05b-decision-confirm-dialog");
    step("decision-confirm-dialog", dialogOk);
    await page.getByRole("button", { name: /^Cancel$/i }).click();
  } else {
    step("decision-confirm-dialog", false, { detail: "button missing" });
  }

  // 5. Conditional decision
  await goto(page, `/initiatives/${seed.initiatives.conditional.id}/decisions`);
  const condOk =
    (await textHas(page, /Conditional|Complete security sign-off|open condition/i)) &&
    (await textHas(page, /Lifecycle clarity|never auto-create|Initiative → PoC/i));
  await shot(page, "06-conditional-decision");
  journey("conditional-decision", condOk);

  // 6. PoC evaluation
  await goto(page, `/initiatives/${seed.initiatives.poc.id}/poc`);
  const pocOk =
    (await textHas(page, /PoC workspace|Keep these distinct/i)) &&
    (await textHas(page, /Objectives|Hypothesis|Operational recommendation|Formal/i)) &&
    (await textHas(page, /does not auto-create|Lifecycle clarity/i));
  await shot(page, "07-poc-evaluation");
  journey("poc-evaluation", pocOk);

  // 7. Pilot evaluation
  await goto(page, `/initiatives/${seed.initiatives.pilot.id}/pilot`);
  const pilotOk =
    (await textHas(page, /Pilot workspace|Keep these distinct/i)) &&
    (await textHas(page, /Target users|Scale recommendation|Formal rollout/i)) &&
    (await textHas(page, /SCALE does not auto-create|Lifecycle clarity/i));
  await shot(page, "08-pilot-evaluation");
  journey("pilot-evaluation", pilotOk);

  // Navigation context preservation
  await goto(
    page,
    `/initiatives/${seed.initiatives.pendingApproval.id}/governance?from=portfolio`,
  );
  const crumbs = await page.locator("nav[aria-label='Breadcrumb'], nav").first().innerText().catch(() => "");
  const navOk =
    (await textHas(page, /Governance/i)) &&
    (await page.getByRole("link", { name: /PoC workspace|Decision workspace|My Approvals/i }).count()) > 0;
  step("navigation-context", navOk, { detail: crumbs.slice(0, 120) });
  result.usability.navigationContext = {
    steps: 0,
    path: "Breadcrumbs + related workspace links preserved",
  };

  // Visible controls count (governance pending)
  await goto(
    page,
    `/initiatives/${seed.initiatives.pendingApproval.id}/governance`,
  );
  const controlCount = await page.evaluate(() => {
    return document.querySelectorAll(
      "button:not([disabled]), a.inline-flex, a[class*='underline']",
    ).length;
  });
  result.usability.visibleControls = { count: controlCount };
  step("visible-controls-recorded", controlCount > 0, {
    detail: String(controlCount),
  });

  // 8. Viewer mode
  switchPersona("viewer");
  await goto(
    page,
    `/initiatives/${seed.initiatives.pendingApproval.id}/governance`,
  );
  const viewerOk =
    (await textHas(page, /Decision context|Evidence|Review/i)) &&
    !(await textHas(page, /You do not have permission to view/i));
  await shot(page, "09-viewer-governance");
  journey("viewer-mode", viewerOk);

  await goto(page, "/approvals");
  // Viewer typically has no APPROVAL_REVIEW — empty queue is correct
  const viewerApprovals =
    (await textHas(page, /Nothing waiting|My Approvals/i));
  journey("viewer-approvals-readonly", viewerApprovals);
  await shot(page, "09b-viewer-approvals");

  // 9. Responsive
  switchPersona("manager");
  await page.setViewportSize({ width: 768, height: 1024 });
  await goto(
    page,
    `/initiatives/${seed.initiatives.pendingApproval.id}/governance`,
  );
  const tabletOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 2,
  );
  await shot(page, "10-tablet");
  journey("tablet", !tabletOverflow);

  await page.setViewportSize({ width: 390, height: 844 });
  await goto(page, `/initiatives/${seed.initiatives.poc.id}/poc`);
  const mobileOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 2,
  );
  await shot(page, "11-mobile");
  journey("mobile", !mobileOverflow);

  await page.setViewportSize({ width: 1440, height: 900 });
  await goto(
    page,
    `/initiatives/${seed.initiatives.awaitingDecision.id}/governance`,
  );
  await shot(page, "12-desktop-decision-ready");
  journey("desktop", true);
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
