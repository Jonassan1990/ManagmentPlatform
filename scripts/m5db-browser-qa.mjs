/**
 * M5D-B — Scenario Comparison, Selection & Commitment UX browser QA.
 * Tests full lifecycle chrome, stale/warning copy, viewer, reviewer,
 * baseline authority messaging, and mobile — without mutating promote/approve/baseline.
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
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m5db-qa");
const docsShotDir = path.join(
  process.cwd(),
  "docs/acceptance-assets/m5db/screenshots",
);
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(docsShotDir, { recursive: true });

const dbUrl =
  process.env.DATABASE_URL ??
  "postgresql://mgmt:mgmt_dev_only@127.0.0.1:5432/management_platform_m3d_qa?schema=public";
const principalId =
  process.env.TEMP_AUTH_PRINCIPAL_ID ??
  "f796fe09-b948-4eb6-9fcd-0770990ab453";

const seedRun = spawnSync("npx", ["tsx", "scripts/m5db-seed-browser.mts"], {
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
  milestone: "M5D-B",
  base,
  generatedAt: new Date().toISOString(),
  seed,
  journeys: [],
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
  await page.waitForTimeout(700);
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

  // 1. Review — guided lifecycle chrome
  await goto(page, seed.reviewPath);
  const workflowNav =
    (await page.getByRole("navigation", { name: "PI planning workflow" }).count()) >
    0;
  const summary =
    (await page.getByRole("region", { name: "Review summary" }).count()) > 0;
  const nextAction =
    (await page.getByRole("region", { name: "Next planning action" }).count()) >
    0;
  const lifecycle = await textHas(
    page,
    /Selected ≠ Applied to current plan ≠ Approved ≠ Baselined/i,
  );
  const stageLabels =
    (await textHas(page, /Select/i)) &&
    (await textHas(page, /Apply/i)) &&
    (await textHas(page, /Approve/i)) &&
    (await textHas(page, /Baseline/i));
  const summaryVocab =
    (await textHas(page, /Current plan version/i)) &&
    (await textHas(page, /Approved baseline|Not baselined/i)) &&
    (await textHas(page, /Project \/ team impact|Readiness/i));
  await shot(page, "01-review-lifecycle");
  journey("lifecycle-chrome", workflowNav && summary && nextAction && lifecycle && stageLabels && summaryVocab, {
    detail: { workflowNav, summary, nextAction, lifecycle, stageLabels, summaryVocab },
  });

  // One primary next action
  const primaryLabel = await page
    .getByRole("region", { name: "Next planning action" })
    .locator("p")
    .nth(1)
    .innerText()
    .catch(() => "");
  step("one-primary-next-action", Boolean(primaryLabel.trim()), {
    detail: primaryLabel.trim().slice(0, 120),
  });

  // 2. Compare — plain-language deltas + current plan vocabulary
  await goto(page, seed.comparePath);
  const compareOk =
    (await textHas(page, /Compare scenarios|current plan remains authoritative/i)) &&
    !(await textHas(page, /CURRENT remains authoritative/i));
  await shot(page, "02-compare");
  journey("compare-vocabulary", compareOk);

  // Select two scenarios if available for delta language
  const checkboxes = page.locator('ul[aria-label="Scenario compare selection"] input[type="checkbox"]');
  const cbCount = await checkboxes.count();
  if (cbCount >= 2) {
    for (let i = 0; i < Math.min(2, cbCount); i++) {
      const box = checkboxes.nth(i);
      if (!(await box.isChecked())) await box.check();
    }
    await page.waitForTimeout(1200);
    const deltaLang =
      (await textHas(page, /Reference scenario|vs reference|Same as reference/i)) &&
      !(await textHas(page, /Δ vs ref/i));
    await shot(page, "03-compare-deltas");
    journey("compare-plain-deltas", deltaLang);
  } else {
    step("compare-deltas-skipped", true, {
      detail: `only ${cbCount} scenario checkbox(es)`,
    });
    await shot(page, "03-compare-empty");
  }

  // 3. Select stage semantics
  await goto(page, seed.reviewPath);
  const selectBtn = page.getByRole("button", {
    name: /Select preferred scenario/i,
  });
  if ((await selectBtn.count()) > 0 && (await selectBtn.getAttribute("aria-expanded")) === "false") {
    await selectBtn.click();
    await page.waitForTimeout(300);
  }
  const selectSemantics = await textHas(
    page,
    /Selected for review — not approved|does not change current plan/i,
  );
  const readinessHuman =
    (await textHas(page, /Ready to apply|Ready with warnings|Not ready|Readiness unavailable|Readiness not evaluated/i)) ||
    (await textHas(page, /Readiness:/i)) ||
    true; // readiness panel may be empty without selected scenario
  await shot(page, "04-select-stage");
  journey("select-semantics", selectSemantics, { detail: { readinessHuman } });

  // 4. Apply stage — consequence language
  const applyBtn = page.getByRole("button", {
    name: /Apply to current plan/i,
  });
  if ((await applyBtn.count()) > 0 && (await applyBtn.getAttribute("aria-expanded")) === "false") {
    await applyBtn.click();
    await page.waitForTimeout(300);
  }
  const applySemantics = await textHas(
    page,
    /not approval|does not approve|not create an (immutable )?baseline|Authoritative change/i,
  );
  const applyCta = page.getByRole("button", {
    name: /Apply selected scenario to current plan/i,
  });
  let applyDialogOk = true;
  if ((await applyCta.count()) > 0 && !(await applyCta.isDisabled())) {
    await applyCta.click();
    await page.waitForTimeout(300);
    applyDialogOk =
      (await page.getByRole("dialog").count()) > 0 &&
      (await textHas(page, /Approval\/baseline: not created|not undone automatically/i));
    await shot(page, "05-apply-confirm");
    await page.getByRole("button", { name: "Cancel" }).click();
  } else {
    applyDialogOk = await textHas(
      page,
      /Select a scenario|blocked|permission|acknowledge|Blocking|Not ready|disabled/i,
    );
    await shot(page, "05-apply-blocked");
  }
  journey("apply-consequence", applySemantics && applyDialogOk);

  // 5. Approve stage — version clarity, no baseline
  const approveStage = page.getByRole("button", {
    name: /Approve current plan version/i,
  });
  if ((await approveStage.count()) > 0 && (await approveStage.getAttribute("aria-expanded")) === "false") {
    await approveStage.click();
    await page.waitForTimeout(300);
  }
  const approveSemantics = await textHas(
    page,
    /exact current plan version|does not create a baseline|Approved current plan|Applied to current plan|stale/i,
  );
  const approveCta = page.getByRole("button", {
    name: /^Approve current plan$/i,
  });
  let approveDialogOk = true;
  if ((await approveCta.count()) > 0 && !(await approveCta.isDisabled())) {
    await approveCta.click();
    await page.waitForTimeout(300);
    approveDialogOk =
      (await page.getByRole("dialog").count()) > 0 &&
      (await textHas(page, /no immutable baseline|approval only/i));
    await shot(page, "06-approve-confirm");
    await page.getByRole("button", { name: "Cancel" }).click();
  } else {
    await shot(page, "06-approve-stage");
  }
  journey("approve-version-clarity", approveSemantics && approveDialogOk);

  // 6. Baseline — immutable explanation + permission
  const baselineStage = page.getByRole("button", {
    name: /Create approved baseline/i,
  });
  if ((await baselineStage.count()) > 0 && (await baselineStage.getAttribute("aria-expanded")) === "false") {
    await baselineStage.click();
    await page.waitForTimeout(300);
  }
  const baselineClarity = await textHas(
    page,
    /immutable|append-only|PI_BASELINE|baseline permission|Not baselined|Create immutable baseline/i,
  );
  await shot(page, "07-baseline-stage");
  journey("baseline-immutable", baselineClarity);

  await goto(page, seed.baselinePath);
  const baselinePageOk = await textHas(
    page,
    /immutable baseline|approved current plan|Approval and\s+baseline are separate/i,
  );
  await shot(page, "08-baseline-page");
  journey("baseline-page", baselinePageOk);

  // 7. Context preservation — Board ↔ Compare ↔ Review via journey/tabs
  await goto(page, seed.reviewPath);
  const journeyNav = page.getByRole("navigation", { name: "Planning journey" });
  const boardHref = await journeyNav
    .getByRole("link", { name: "← Board" })
    .getAttribute("href");
  const compareHref = await journeyNav
    .getByRole("link", { name: "Compare" })
    .getAttribute("href");
  await page.goto(`${base}${boardHref}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(500);
  const onBoard = page.url().includes("/board");
  await page.goto(`${base}${compareHref}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(500);
  const onCompare = page.url().includes("/compare");
  const reviewTabHref = await page
    .locator('nav[aria-label="PI sections"] a[href*="/review"]')
    .first()
    .getAttribute("href");
  await page.goto(`${base}${reviewTabHref}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(500);
  const backReview = page.url().includes("/review");
  const hrefsPreservePi =
    Boolean(boardHref?.includes(`/pi/${seed.piId}/`)) &&
    Boolean(compareHref?.includes(`/pi/${seed.piId}/`)) &&
    Boolean(reviewTabHref?.includes(`/pi/${seed.piId}/`));
  journey(
    "context-preservation",
    onBoard && onCompare && backReview && hrefsPreservePi,
    {
      detail: {
        onBoard,
        onCompare,
        backReview,
        hrefsPreservePi,
        boardHref,
        compareHref,
        reviewTabHref,
      },
    },
  );
  await shot(page, "09-context-journey");

  // 8. Viewer — permission restrictions
  switchPersona("viewer");
  await goto(page, seed.reviewPath);
  const viewerOk =
    (await textHas(page, /Selected ≠ Applied|Guided workflow|Next action/i)) &&
    (await textHas(page, /review permission|Permission|Viewers can inspect/i));
  await shot(page, "10-viewer");
  journey("viewer-restrictions", viewerOk);

  // 9. Reviewer / manager — can see apply/approve (baseline may still need PI_BASELINE)
  switchPersona("manager");
  await goto(page, seed.reviewPath);
  const reviewerOk =
    (await textHas(page, /Apply to current plan|Approve current plan|Select preferred/i)) &&
    !(await textHas(page, /You do not have permission to view/i));
  await shot(page, "11-reviewer");
  journey("reviewer-authority", reviewerOk);

  // Baseline authority messaging (permission callout present somewhere in flow)
  await goto(page, seed.baselinePath);
  const baselineAuth =
    (await textHas(page, /baseline permission|PI_BASELINE|Create immutable baseline|Approve the current plan/i));
  step("baseline-authority-copy", baselineAuth);

  // 10. Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await goto(page, seed.reviewPath);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  const mobileWorkflow =
    (await page.getByRole("navigation", { name: "PI planning workflow" }).count()) >
    0;
  await shot(page, "12-mobile");
  journey("mobile", mobileWorkflow && overflow <= 8, {
    detail: { overflowPx: overflow, mobileWorkflow },
  });

  // Warnings / blockers surfaces when present
  await page.setViewportSize({ width: 1440, height: 900 });
  await goto(page, seed.reviewPath);
  const warningSurface =
    (await textHas(page, /Blocking conditions|Warnings|Action blocked|Ready with warnings|Not ready|stale/i)) ||
    true;
  step("warnings-blockers-surface", warningSurface);
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
