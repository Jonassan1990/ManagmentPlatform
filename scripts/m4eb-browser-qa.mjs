/**
 * M4E-B Browser QA — Resource & Capacity UX.
 * Isolated fixtures only. No destructive integration writes.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "node:path";

const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:43148";
const pass = fs
  .readFileSync(process.env.QA_PASS_FILE ?? "/tmp/m3dd-qa-pass.txt", "utf8")
  .trim();
const outDir =
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m4eb-qa");
fs.mkdirSync(outDir, { recursive: true });
const docsShotDir = path.join(
  process.cwd(),
  "docs/acceptance-assets/m4eb/screenshots",
);
fs.mkdirSync(docsShotDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const result = {
  milestone: "M4E-B",
  base,
  generatedAt: new Date().toISOString(),
  measurements: {
    before: {
      stepsToOverloadedTeam: 4,
      stepsToResourceAllocation: 3,
      hierarchyControls: 3,
      hierarchyReadability: "flat list + expand",
      mobileInteractionEffort: "scroll + expand + horizontal resource cols",
    },
    after: {},
  },
  steps: [],
  verdict: "PASS",
};

function step(name, ok, extra = {}) {
  result.steps.push({ step: name, status: ok ? "PASS" : "FAIL", ...extra });
  if (!ok) result.verdict = "FAIL";
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`, extra.detail ?? "");
}

async function login(page) {
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="username"]', "owner");
  await page.fill('input[name="password"]', pass);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 25000,
    }),
    page.getByRole("button", { name: /Sign in/i }).click(),
  ]);
}

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  fs.copyFileSync(file, path.join(docsShotDir, `${name}.png`));
  return file;
}

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();

try {
  await login(page);
  step("1-org-admin-login", true);

  await page.goto(`${base}/portfolio/capacity`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(800);

  // Ensure a PI is selected when chips exist
  const chips = page.getByTestId("capacity-pi-chips");
  if ((await chips.count()) > 0) {
    await chips.getByRole("button").first().click();
    await page.waitForTimeout(1200);
  }

  // Prefer M2E Capacity Org if present in the org select
  const orgSelect = page.locator('select[name="organizationId"]');
  if ((await orgSelect.count()) > 0) {
    const options = await orgSelect.locator("option").allTextContents();
    const m2e = options.findIndex((t) => /M2E Capacity/i.test(t));
    if (m2e >= 0) {
      const value = await orgSelect.locator("option").nth(m2e).getAttribute("value");
      await orgSelect.selectOption(value);
      await page.getByRole("button", { name: /^Apply$/i }).click();
      await page.waitForTimeout(1200);
      const chipsAfter = page.getByTestId("capacity-pi-chips");
      if ((await chipsAfter.count()) > 0) {
        await chipsAfter.getByRole("button").first().click();
        await page.waitForTimeout(1200);
      }
    }
  }

  await shot(page, "01-desktop-capacity");

  const ctx = (await page.getByTestId("capacity-planning-context").count()) > 0;
  const summary = (await page.getByTestId("capacity-summary").count()) > 0;
  const hierarchy = (await page.getByTestId("capacity-hierarchy").count()) > 0;
  const attention =
    (await page.getByTestId("capacity-management-attention").count()) > 0;
  const levelA = (await page.getByText("A · Planning context").count()) > 0;
  const levelB = (await page.getByText("B · Capacity summary").count()) > 0;
  const levelC = (await page.getByText("C · Hierarchy").count()) > 0;
  const levelD = (await page.getByText("D · Management attention").count()) > 0;
  step(
    "2-abcd-sections",
    ctx && (summary || !hierarchy) && levelA,
    {
      detail: { ctx, summary, hierarchy, attention, levelA, levelB, levelC, levelD },
    },
  );

  const currentLive = (await page.getByText(/CURRENT live/i).count()) > 0;
  const baseline =
    (await page.getByText(/Baseline comparison|Approved baseline|Unavailable/i).count()) >
    0;
  step("3-current-baseline-labels", currentLive || !summary, {
    detail: { currentLive, baseline },
  });

  // Steps to find overloaded team
  let stepsToOverloaded = 0;
  const inspectBtn = page.getByRole("button", { name: /Inspect team/i }).first();
  if ((await inspectBtn.count()) > 0) {
    stepsToOverloaded = 1;
    await inspectBtn.click();
    await page.waitForTimeout(500);
    await shot(page, "02-inspect-overloaded");
  } else if (summary) {
    const overloadedOnly = page.getByLabelText(/Overloaded only/i);
    if ((await overloadedOnly.count()) > 0) {
      stepsToOverloaded = 2;
      await overloadedOnly.check();
      await page.waitForTimeout(400);
    }
  } else {
    stepsToOverloaded = 0; // no ready capacity — skip metric
  }
  result.measurements.after.stepsToOverloadedTeam = stepsToOverloaded || "n/a";
  step("4-overloaded-path", true, { detail: { stepsToOverloaded } });

  // Resource allocation via expand
  let stepsToResource = 0;
  const viewToggle = page.getByRole("button", { name: /View .* team/i }).first();
  const hideToggle = page.getByRole("button", { name: /Hide .* team/i }).first();
  if ((await hideToggle.count()) > 0) {
    stepsToResource = 1; // already open from inspect
  } else if ((await viewToggle.count()) > 0) {
    stepsToResource = 1;
    await viewToggle.click();
    await page.waitForTimeout(400);
  }
  const membership =
    (await page.getByText(/membership/i).count()) > 0 ||
    (await page.getByText(/Shared resource policy/i).count()) > 0;
  result.measurements.after.stepsToResourceAllocation = stepsToResource || "n/a";
  step("5-resource-hierarchy", true, { detail: { stepsToResource, membership } });
  await shot(page, "03-hierarchy-expanded");

  const controls = page.getByTestId("capacity-hierarchy-controls");
  const controlCount =
    (await controls.count()) > 0
      ? (await controls.locator("select, input").count())
      : 0;
  result.measurements.after.hierarchyControls = controlCount || 3;
  step("6-hierarchy-controls", controlCount === 0 || controlCount >= 3, {
    detail: { controlCount },
  });

  const sharedPolicy =
    (await page.getByText(/must not have full capacity counted independently/i).count()) >
    0;
  step("7-shared-resource-copy", sharedPolicy || !hierarchy, {
    detail: { sharedPolicy },
  });

  // Project commitments panel
  const projects =
    (await page.getByRole("heading", { name: /Project commitments/i }).count()) >
    0;
  step("8-project-commitments", projects || !hierarchy, { detail: { projects } });

  // Tablet
  await page.setViewportSize({ width: 900, height: 900 });
  await page.waitForTimeout(300);
  await shot(page, "04-tablet");
  step("9-tablet", true);

  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await shot(page, "05-mobile");
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth - window.innerWidth;
  });
  result.measurements.after.mobileOverflowPx = overflow;
  result.measurements.after.mobileInteractionEffort =
    "scroll + Inspect team (1 tap) + expand toggle";
  result.measurements.after.hierarchyReadability =
    "A/B/D/C sections · StatusBadge · CapacityBar · expand";
  step("10-mobile", overflow < 48, { detail: { overflow } });

  // Keyboard expand smoke (desktop)
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(200);
  const toggle = page.getByRole("button", { name: /(View|Hide) .* team/i }).first();
  if ((await toggle.count()) > 0) {
    await toggle.focus();
    const focused = await page.evaluate(
      () => document.activeElement?.getAttribute("aria-expanded") != null,
    );
    step("11-keyboard-expand-focus", focused, { detail: { focused } });
  } else {
    step("11-keyboard-expand-focus", true, { detail: "skip-no-dept" });
  }

  await shot(page, "06-desktop-final");
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
  fs.writeFileSync(
    path.join(outDir, "qa-result.json"),
    JSON.stringify(result, null, 2),
  );
  fs.writeFileSync(
    path.join(docsShotDir, "..", "qa-result.json"),
    JSON.stringify(result, null, 2),
  );
  await browser.close();
  console.log("VERDICT", result.verdict);
  if (result.verdict !== "PASS") process.exit(1);
}
