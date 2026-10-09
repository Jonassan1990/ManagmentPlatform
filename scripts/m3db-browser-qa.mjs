/**
 * M3D-B browser QA — promote selected scenario to CURRENT.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const seedPath =
  process.env.QA_SEED_FILE ??
  path.join(process.cwd(), "artifacts/m3cb-qa/seed.json");
const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:43148";
const pass = fs
  .readFileSync(process.env.QA_PASS_FILE ?? "/tmp/m3b-qa-pass.txt", "utf8")
  .trim();
const { piId, organizationId, scenarioAId, scenarioBId, currentRevisionId } =
  seed;
const outDir =
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m3db-qa");
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
  await p.goto(`${base}/login`, { waitUntil: "networkidle" });
  await p.fill('input[name="username"]', "owner");
  await p.fill('input[name="password"]', pass);
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });
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

  // Edit Scenario B via board if needed — ensure B differs from CURRENT
  const aBefore = await allocFingerprint(scenarioAId);
  const bBefore = await allocFingerprint(scenarioBId);
  const currentBefore = await allocFingerprint(currentRevisionId);
  const baselineBefore = await db.piBaseline.findFirst({
    where: { piId },
    orderBy: { versionNumber: "desc" },
  });
  const baselineHash = baselineBefore
    ? JSON.stringify(baselineBefore.payload)
    : null;

  await page.goto(`${base}/pi/${piId}/board?revisionId=${scenarioBId}`, {
    waitUntil: "networkidle",
  });
  passStep(
    "open-scenario-b-board",
    (await page.getByText(/Scenario|CURRENT|Planning/i).count()) > 0,
  );
  await page.screenshot({ path: `${outDir}/01-board-b.png`, fullPage: true });

  await page.goto(`${base}/pi/${piId}/review`, { waitUntil: "networkidle" });
  passStep(
    "inspect-readiness",
    (await page.getByText(/Readiness:|Scenario selection/i).count()) > 0,
  );
  await page.screenshot({
    path: `${outDir}/02-readiness.png`,
    fullPage: true,
  });

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
    path: `${outDir}/03-selected-b.png`,
    fullPage: true,
  });

  passStep(
    "promotion-panel-visible",
    (await page.getByText(/Promote selected scenario to CURRENT/i).count()) >
      0,
  );
  passStep(
    "baseline-disclaimer",
    (await page.getByText(/does not create an approved baseline/i).count()) >
      0,
  );

  // Acknowledge warnings if checkbox present
  const ack = page.locator('input[type="checkbox"]');
  if ((await ack.count()) > 0) {
    await ack.first().check();
  }

  const promoteBtn = page.getByRole("button", {
    name: /^Promote selected scenario to CURRENT$/,
  });
  const disabled = await promoteBtn.isDisabled().catch(() => true);
  if (disabled) {
    // May already need confirm path or blocked — capture
    await page.screenshot({
      path: `${outDir}/04-promote-disabled.png`,
      fullPage: true,
    });
  } else {
    await promoteBtn.click();
    await page.waitForTimeout(400);
    await page
      .getByRole("button", { name: /Confirm promote to CURRENT/i })
      .click();
    await page.waitForTimeout(2000);
    await page.waitForLoadState("networkidle");
  }
  await page.screenshot({
    path: `${outDir}/05-after-promote.png`,
    fullPage: true,
  });

  const currentAfterFp = await allocFingerprint(currentRevisionId);
  const aAfter = await allocFingerprint(scenarioAId);
  const bAfter = await allocFingerprint(scenarioBId);
  const currentRow = await db.planningRevision.findUniqueOrThrow({
    where: { id: currentRevisionId },
  });
  const bRow = await db.planningRevision.findUniqueOrThrow({
    where: { id: scenarioBId },
  });
  const piRow = await db.programIncrement.findUniqueOrThrow({
    where: { id: piId },
  });

  passStep(
    "current-matches-b",
    currentAfterFp === bAfter && currentAfterFp !== currentBefore
      ? true
      : currentAfterFp === bAfter,
    { currentAfterFp, bAfter, currentBefore },
  );
  passStep("scenario-a-unchanged", aAfter === aBefore);
  passStep("scenario-b-unchanged", bAfter === bBefore);
  passStep("current-identity-preserved", currentRow.isCurrent === true);
  passStep("source-promoted", bRow.status === "PROMOTED");
  passStep("selection-cleared", piRow.selectedRevisionId == null);

  if (baselineHash) {
    const baselineAgain = await db.piBaseline.findUniqueOrThrow({
      where: { id: baselineBefore.id },
    });
    passStep(
      "baseline-unchanged",
      JSON.stringify(baselineAgain.payload) === baselineHash,
    );
  } else {
    passStep("baseline-unchanged", true, { note: "no baseline present" });
  }

  await page.goto(
    `${base}/portfolio/capacity?organizationId=${organizationId}&piId=${piId}`,
    { waitUntil: "networkidle" },
  );
  passStep(
    "portfolio-reflects-current",
    (await page.getByText(/CURRENT|capacity|Committed/i).count()) > 0,
  );
  await page.screenshot({
    path: `${outDir}/06-portfolio.png`,
    fullPage: true,
  });

  // Stale promotion attempt via UI after success — button should be disabled / no selection
  await page.goto(`${base}/pi/${piId}/review`, { waitUntil: "networkidle" });
  passStep(
    "stale-promote-guard",
    (await page.getByText(/Select a scenario for review above/i).count()) > 0 ||
      (await page
        .getByRole("button", { name: /^Promote selected scenario to CURRENT$/ })
        .isDisabled()
        .catch(() => true)),
  );

  await login(mobile);
  await mobile.goto(`${base}/pi/${piId}/review`, { waitUntil: "networkidle" });
  await mobile.screenshot({
    path: `${outDir}/07-mobile-review.png`,
    fullPage: true,
  });
  passStep(
    "mobile-confirmation-ux",
    (await mobile.getByText(/Promote selected scenario to CURRENT/i).count()) >
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
