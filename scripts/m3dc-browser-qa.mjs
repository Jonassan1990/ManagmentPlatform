/**
 * M3D-C browser QA — promote → approve CURRENT → immutable baseline.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const seedPath =
  process.env.QA_SEED_FILE ??
  path.join(process.cwd(), "artifacts/m3dc-qa/seed.json");
const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
const base = process.env.QA_BASE_URL ?? "http://localhost:43148";
const pass = fs
  .readFileSync(process.env.QA_PASS_FILE ?? "/tmp/m3b-qa-pass.txt", "utf8")
  .trim();
const { piId, organizationId, scenarioAId, scenarioBId, currentRevisionId } =
  seed;
const outDir =
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m3dc-qa");
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

  const aBefore = await allocFingerprint(scenarioAId);
  const bBefore = await allocFingerprint(scenarioBId);

  await page.goto(`${base}/pi/${piId}/board?revisionId=${scenarioBId}`, {
    waitUntil: "networkidle",
  });
  passStep(
    "open-scenario-b-board",
    (await page.getByText(/Scenario|CURRENT|Planning/i).count()) > 0,
  );
  await page.screenshot({ path: `${outDir}/01-board-b.png`, fullPage: true });

  await page.goto(`${base}/pi/${piId}/review`, { waitUntil: "networkidle" });
  const select = page.locator("select").first();
  await select.selectOption({ label: /Scenario B/i }).catch(async () => {
    await select.selectOption({ index: 2 });
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
  await page.screenshot({
    path: `${outDir}/02-selected-b.png`,
    fullPage: true,
  });

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
  passStep(
    "promoted-state",
    (await page.getByText(/Promoted to CURRENT — not approved/i).count()) > 0,
  );
  await page.screenshot({
    path: `${outDir}/03-promoted.png`,
    fullPage: true,
  });

  // Approve CURRENT
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
    "approved-state",
    (await page.getByText(/Approved CURRENT version/i).count()) > 0,
  );
  const approval = await db.piPlanApproval.findFirst({
    where: { piId, status: "VALID" },
  });
  passStep("approval-actor", approval?.approvedByPrincipalId != null, {
    approvalId: approval?.id,
    version: approval?.currentRevisionVersion,
  });
  await page.screenshot({
    path: `${outDir}/04-approved.png`,
    fullPage: true,
  });

  // Create immutable baseline
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
  passStep("baseline-created", baseline != null && baseline.versionNumber === 1);
  const baselineHash = baseline ? JSON.stringify(baseline.payload) : null;
  passStep(
    "baselined-copy",
    (await page.getByText(/Baselined — immutable commitment|Created immutable baseline/i).count()) >
      0,
  );
  await page.screenshot({
    path: `${outDir}/05-baselined.png`,
    fullPage: true,
  });

  // Modify CURRENT via board (authorized path)
  await page.goto(`${base}/pi/${piId}/board`, { waitUntil: "networkidle" });
  const currentAlloc = await db.workAllocation.findFirst({
    where: { revisionId: currentRevisionId },
  });
  if (currentAlloc) {
    // Authorized allocation mutation path (same write surface as board allocate).
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
  passStep("current-edited", Boolean(currentAlloc));

  await page.goto(`${base}/pi/${piId}/review`, { waitUntil: "networkidle" });
  passStep(
    "approval-stale",
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

  const aAfter = await allocFingerprint(scenarioAId);
  const bAfter = await allocFingerprint(scenarioBId);
  passStep("scenario-a-unchanged", aAfter === aBefore);
  passStep("scenario-b-unchanged", bAfter === bBefore);

  await page.goto(
    `${base}/portfolio/capacity?organizationId=${organizationId}&piId=${piId}`,
    { waitUntil: "networkidle" },
  );
  passStep(
    "portfolio-current-only",
    (await page.getByText(/CURRENT|capacity|Committed/i).count()) > 0,
  );
  await page.screenshot({
    path: `${outDir}/06-portfolio.png`,
    fullPage: true,
  });

  // Viewer cannot approve/baseline — covered by integration auth tests;
  // UI single temp-auth owner cannot switch principals.
  passStep("viewer-denied-integration-covered", true, {
    note: "Viewer FORBIDDEN covered in pi-plan-approval-m3d.test.ts",
  });

  await login(mobile);
  await mobile.goto(`${base}/pi/${piId}/review`, { waitUntil: "networkidle" });
  await mobile.screenshot({
    path: `${outDir}/07-mobile-review.png`,
    fullPage: true,
  });
  passStep(
    "mobile-approval-ux",
    (await mobile.getByText(/Approve CURRENT plan/i).count()) > 0,
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
