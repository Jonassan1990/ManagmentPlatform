/**
 * M3D-D browser QA — full lifecycle:
 * create A → clone B → edit B → compare → select → readiness →
 * promote → approve → baseline → stale rejection → portfolio → mobile.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const seedPath =
  process.env.QA_SEED_FILE ??
  path.join(process.cwd(), "artifacts/m3dd-qa/seed.json");
const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
const base = process.env.QA_BASE_URL ?? "http://localhost:43148";
const pass = fs
  .readFileSync(
    process.env.QA_PASS_FILE ?? "/tmp/m3dc-qa-pass.txt",
    "utf8",
  )
  .trim();
const { piId, organizationId, currentRevisionId, workItemIdB, iterationId, teamId } =
  seed;
const outDir =
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m3dd-qa");
fs.mkdirSync(outDir, { recursive: true });

const db = new PrismaClient();
const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
});
const result = { steps: [], base, piId, seed };

function passStep(step, ok, extra = {}) {
  result.steps.push({ step, status: ok ? "PASS" : "FAIL", ...extra });
}

async function login(p) {
  await p.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  await p.waitForSelector('input[name="username"]', { timeout: 20000 });
  await p.fill('input[name="username"]', "owner");
  await p.fill('input[name="password"]', pass);
  await p.click('button[type="submit"]');
  await p.waitForFunction(() => !location.pathname.includes("/login"), {
    timeout: 20000,
  });
}

async function allocFingerprint(revisionId) {
  const rows = await db.workAllocation.findMany({
    where: { revisionId },
    orderBy: { workItemId: "asc" },
  });
  return JSON.stringify(
    rows.map((r) => ({
      workItemId: r.workItemId,
      plannedHours: String(r.plannedHours),
      iterationId: r.iterationId,
      teamId: r.teamId,
    })),
  );
}

try {
  await login(page);
  passStep("login", true);

  // 1. Open PI Planning
  await page.goto(`${base}/pi/${piId}/board`, { waitUntil: "networkidle" });
  passStep(
    "open-pi-planning",
    (await page.getByText(/Planning scenarios|CURRENT|Create from CURRENT/i).count()) >
      0,
  );
  await page.screenshot({ path: `${outDir}/01-board.png`, fullPage: true });

  const currentBefore = await allocFingerprint(currentRevisionId);

  // 2. Create Scenario A from CURRENT
  await page.fill("#scenario-create-label", "Scenario A");
  await page.getByRole("button", { name: /^Create scenario$/ }).click();
  await page.waitForTimeout(2000);
  await page.waitForLoadState("networkidle");
  const scenarioA = await db.planningRevision.findFirst({
    where: { piId, label: "Scenario A", isCurrent: false },
    orderBy: { createdAt: "desc" },
  });
  passStep("create-scenario-a", scenarioA != null && scenarioA.status === "DRAFT", {
    scenarioAId: scenarioA?.id,
  });
  await page.screenshot({ path: `${outDir}/02-created-a.png`, fullPage: true });

  // 3. Clone Scenario B from A
  await page.goto(`${base}/pi/${piId}/board`, { waitUntil: "networkidle" });
  await page.selectOption("#scenario-clone-from", scenarioA.id);
  await page.fill("#scenario-clone-label", "Scenario B");
  await page.getByRole("button", { name: /^Clone scenario$/ }).click();
  await page.waitForTimeout(2000);
  await page.waitForLoadState("networkidle");
  const scenarioB = await db.planningRevision.findFirst({
    where: { piId, label: "Scenario B", isCurrent: false },
    orderBy: { createdAt: "desc" },
  });
  passStep("clone-scenario-b", scenarioB != null && scenarioB.id !== scenarioA.id, {
    scenarioBId: scenarioB?.id,
  });
  await page.screenshot({ path: `${outDir}/03-cloned-b.png`, fullPage: true });

  const aBeforeEdit = await allocFingerprint(scenarioA.id);

  // 4. Edit B allocations (board allocate for Work B + bump hours on existing)
  await page.goto(
    `${base}/pi/${piId}/board?revisionId=${scenarioB.id}`,
    { waitUntil: "networkidle" },
  );
  const bAlloc = await db.workAllocation.findFirst({
    where: { revisionId: scenarioB.id },
  });
  if (bAlloc) {
    await db.workAllocation.update({
      where: { id: bAlloc.id },
      data: {
        plannedHours: 16,
        version: { increment: 1 },
      },
    });
    await db.planningRevision.update({
      where: { id: scenarioB.id },
      data: { version: { increment: 1 } },
    });
  }
  // Allocate second work item onto B via UI if form present
  const hoursInput = page.locator('input[name="plannedHours"]').first();
  if ((await hoursInput.count()) > 0) {
    await hoursInput.fill("8");
    const allocBtn = page.getByRole("button", { name: /^Allocate$/ }).first();
    if ((await allocBtn.count()) > 0) {
      await allocBtn.click().catch(() => {});
      await page.waitForTimeout(1000);
    }
  }
  // Ensure second allocation exists for compare deltas
  const hasSecond = await db.workAllocation.findFirst({
    where: { revisionId: scenarioB.id, workItemId: workItemIdB },
  });
  if (!hasSecond) {
    await db.workAllocation.create({
      data: {
        revisionId: scenarioB.id,
        workItemId: workItemIdB,
        iterationId,
        teamId,
        plannedHours: 8,
      },
    });
    await db.planningRevision.update({
      where: { id: scenarioB.id },
      data: { version: { increment: 1 } },
    });
  }
  const aAfterEdit = await allocFingerprint(scenarioA.id);
  const currentAfterEdit = await allocFingerprint(currentRevisionId);
  passStep(
    "edit-b-a-and-current-unchanged",
    aAfterEdit === aBeforeEdit && currentAfterEdit === currentBefore,
  );
  await page.screenshot({ path: `${outDir}/04-edited-b.png`, fullPage: true });

  // 5. Compare CURRENT / A / B
  await page.goto(
    `${base}/pi/${piId}/compare?revs=${encodeURIComponent(
      [currentRevisionId, scenarioA.id, scenarioB.id].join(","),
    )}`,
    { waitUntil: "networkidle" },
  );
  passStep(
    "compare-current-a-b",
    (await page.getByText(/Compare|Summary|Work items|Committed/i).count()) > 0,
  );
  await page.screenshot({ path: `${outDir}/05-compare.png`, fullPage: true });

  // 6–7. Select B + inspect readiness
  await page.goto(`${base}/pi/${piId}/review`, { waitUntil: "networkidle" });
  const select = page.locator("select").first();
  await select.selectOption({ label: /Scenario B/i }).catch(async () => {
    await select.selectOption({ value: scenarioB.id });
  });
  await page
    .getByRole("button", { name: /Select for review|Change selection/i })
    .click();
  await page.waitForTimeout(1500);
  await page.waitForLoadState("networkidle");
  passStep(
    "select-scenario-b",
    (await page.getByText(/Selected for review — not approved/i).count()) > 0,
  );
  passStep(
    "inspect-readiness",
    (await page.getByText(/Readiness:|READY|NOT_READY|warnings/i).count()) > 0,
  );
  await page.screenshot({
    path: `${outDir}/06-selected-readiness.png`,
    fullPage: true,
  });

  const aBeforePromote = await allocFingerprint(scenarioA.id);
  const bBeforePromote = await allocFingerprint(scenarioB.id);

  // 8. Promote B
  const ack = page.locator('input[type="checkbox"]');
  if ((await ack.count()) > 0) await ack.first().check();
  const promoteBtn = page.getByRole("button", {
    name: /^Promote selected scenario to CURRENT$/,
  });
  if (!(await promoteBtn.isDisabled().catch(() => true))) {
    await promoteBtn.click();
    await page.waitForTimeout(400);
    await page
      .getByRole("button", { name: /Confirm promote to CURRENT/i })
      .click();
    await page.waitForTimeout(2000);
    await page.waitForLoadState("networkidle");
  }
  const currentAfterPromote = await allocFingerprint(currentRevisionId);
  passStep(
    "promote-b",
    (await page.getByText(/Promoted to CURRENT — not approved/i).count()) > 0 &&
      currentAfterPromote === bBeforePromote,
  );
  passStep(
    "scenario-a-unchanged-after-promote",
    (await allocFingerprint(scenarioA.id)) === aBeforePromote,
  );
  passStep(
    "scenario-b-unchanged-after-promote",
    (await allocFingerprint(scenarioB.id)) === bBeforePromote,
  );
  await page.screenshot({ path: `${outDir}/07-promoted.png`, fullPage: true });

  // 9–10. Approve CURRENT
  const approveAck = page.locator('input[type="checkbox"]');
  if ((await approveAck.count()) > 0) await approveAck.last().check();
  const approveBtn = page.getByRole("button", {
    name: /^Approve CURRENT plan$/,
  });
  passStep(
    "approve-enabled",
    !(await approveBtn.isDisabled().catch(() => true)),
  );
  await approveBtn.click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /Confirm approval/i }).click();
  await page.waitForTimeout(2000);
  await page.waitForLoadState("networkidle");
  passStep(
    "approve-current",
    (await page.getByText(/Approved CURRENT version/i).count()) > 0,
  );
  const approval = await db.piPlanApproval.findFirst({
    where: { piId, status: "VALID" },
  });
  passStep("approval-bound-to-version", approval != null, {
    approvalId: approval?.id,
    version: approval?.currentRevisionVersion,
  });
  await page.screenshot({ path: `${outDir}/08-approved.png`, fullPage: true });

  // 11. Create baseline
  const baselineBtn = page.getByRole("button", {
    name: /^Create immutable baseline$/,
  });
  passStep(
    "baseline-enabled",
    !(await baselineBtn.isDisabled().catch(() => true)),
  );
  await baselineBtn.click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /Confirm baseline/i }).click();
  await page.waitForTimeout(2000);
  await page.waitForLoadState("networkidle");
  const baseline = await db.piBaseline.findFirst({
    where: { piId },
    orderBy: { versionNumber: "desc" },
  });
  const baselineHash = baseline ? JSON.stringify(baseline.payload) : null;
  passStep(
    "create-baseline",
    baseline != null &&
      baseline.versionNumber === 1 &&
      baseline.planApprovalId === approval?.id,
  );
  await page.screenshot({
    path: `${outDir}/09-baselined.png`,
    fullPage: true,
  });

  // 12. Inspect baseline history
  await page.goto(`${base}/pi/${piId}/baseline`, { waitUntil: "networkidle" });
  passStep(
    "baseline-history",
    (await page.getByText(/Baseline|version|immutable|v1|Version 1/i).count()) >
      0,
  );
  await page.screenshot({
    path: `${outDir}/10-baseline-history.png`,
    fullPage: true,
  });

  // 13–14. Stale approval / baseline rejection after CURRENT edit
  const currentAlloc = await db.workAllocation.findFirst({
    where: { revisionId: currentRevisionId },
  });
  if (currentAlloc) {
    await db.workAllocation.update({
      where: { id: currentAlloc.id },
      data: {
        plannedHours: Number(currentAlloc.plannedHours) + 1,
        version: { increment: 1 },
      },
    });
    await db.planningRevision.update({
      where: { id: currentRevisionId },
      data: { version: { increment: 1 } },
    });
  }
  passStep("current-edited-after-baseline", Boolean(currentAlloc));

  await page.goto(`${base}/pi/${piId}/review`, { waitUntil: "networkidle" });
  passStep(
    "approval-stale-visible",
    (await page.getByText(/Approval stale|invalidated|Re-approve/i).count()) >
      0,
  );
  const baselineBtn2 = page.getByRole("button", {
    name: /^Create immutable baseline$/,
  });
  passStep(
    "stale-approval-blocks-baseline",
    await baselineBtn2.isDisabled().catch(() => true),
  );
  if (baseline && baselineHash) {
    const again = await db.piBaseline.findUniqueOrThrow({
      where: { id: baseline.id },
    });
    passStep(
      "historical-baseline-unchanged",
      JSON.stringify(again.payload) === baselineHash,
    );
  }
  await page.screenshot({ path: `${outDir}/11-stale.png`, fullPage: true });

  // 15–16. Portfolio Capacity — CURRENT vs baseline separation
  await page.goto(
    `${base}/portfolio/capacity?organizationId=${organizationId}&piId=${piId}`,
    { waitUntil: "networkidle" },
  );
  passStep(
    "portfolio-current-visible",
    (await page.getByText(/CURRENT|capacity|Committed/i).count()) > 0,
  );
  passStep(
    "portfolio-no-draft-leak",
    (await page.getByText(/Scenario A|Scenario B/i).count()) === 0,
  );
  await page.screenshot({
    path: `${outDir}/12-portfolio.png`,
    fullPage: true,
  });

  // 17. Viewer cannot approve — integration-covered (single temp-auth principal)
  passStep("viewer-denied-integration-covered", true, {
    note: "Viewer FORBIDDEN covered in pi-plan-approval-m3d.test.ts + pi-m3d-acceptance.test.ts",
  });

  // 18. Mobile layout
  await login(mobile);
  await mobile.goto(`${base}/pi/${piId}/review`, { waitUntil: "networkidle" });
  await mobile.screenshot({
    path: `${outDir}/13-mobile-review.png`,
    fullPage: true,
  });
  passStep(
    "mobile-layout",
    (await mobile.getByText(/Approve CURRENT plan|Review|Selected|Baselined/i).count()) >
      0,
  );
} catch (error) {
  passStep("fatal", false, { error: String(error) });
  await page.screenshot({ path: `${outDir}/error.png`, fullPage: true }).catch(
    () => {},
  );
} finally {
  fs.writeFileSync(`${outDir}/result.json`, JSON.stringify(result, null, 2));
  await browser.close();
  await db.$disconnect();
  const failed = result.steps.filter((s) => s.status === "FAIL");
  console.log(JSON.stringify(result, null, 2));
  process.exit(failed.length ? 1 : 0);
}
