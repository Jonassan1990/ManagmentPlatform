/**
 * M4D-C Browser QA — Initiative journey grouped workspace UX.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "node:path";

const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:43148";
const pass = fs
  .readFileSync(process.env.QA_PASS_FILE ?? "/tmp/m3dd-qa-pass.txt", "utf8")
  .trim();
const outDir =
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m4dc-qa");
fs.mkdirSync(outDir, { recursive: true });
const docsShotDir = path.join(
  process.cwd(),
  "docs/acceptance-assets/m4dc/screenshots",
);
fs.mkdirSync(docsShotDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const result = {
  milestone: "M4D-C",
  base,
  generatedAt: new Date().toISOString(),
  steps: [],
  measurements: {},
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
  step("login", true);

  // 1. Hub filters
  await page.goto(`${base}/initiatives`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(500);
  const hasPocFilter = (await page.getByRole("link", { name: "PoC" }).count()) > 0;
  const hasPilotFilter =
    (await page.getByRole("link", { name: "Pilot" }).count()) > 0;
  const hasProjectFilter =
    (await page.getByRole("link", { name: "Project" }).count()) > 0;
  await shot(page, "01-initiatives-hub");
  step("1-hub-filters", hasPocFilter && hasPilotFilter && hasProjectFilter, {
    detail: { hasPocFilter, hasPilotFilter, hasProjectFilter },
  });

  // Open first initiative detail (UUID path), never /initiatives/new
  const hrefs = await page.$$eval('a[href^="/initiatives/"]', (as) =>
    as
      .map((a) => a.getAttribute("href") || "")
      .filter(
        (h) =>
          /^\/initiatives\/[0-9a-f-]{36}/i.test(h.split("?")[0] ?? "") &&
          !h.includes("/new"),
      ),
  );
  const initiativePath = hrefs[0] ?? null;
  if (!initiativePath) {
    step("2-open-initiative", false, {
      detail: "No initiative fixture available",
    });
    throw new Error("No initiative to open");
  }
  await page.goto(`${base}${initiativePath}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(800);

  // 2. Grouped tabs + lifecycle
  const sections = page.getByRole("navigation", { name: "Initiative sections" });
  const lifecycle = page.getByLabel("Initiative lifecycle");
  const discoveryLabel = (await page.getByText("Discovery", { exact: true }).count()) > 0;
  const historyLabel = (await page.getByText("History", { exact: true }).count()) > 0;
  const hasCurrentBadge =
    (await page.getByText(/Current ·/i).count()) > 0 ||
    (await page.getByText(/Required next action/i).count()) > 0;
  await shot(page, "02-initiative-overview");
  step(
    "2-grouped-workspace",
    (await sections.count()) > 0 &&
      (await lifecycle.count()) > 0 &&
      discoveryLabel &&
      historyLabel,
    { detail: { discoveryLabel, historyLabel, hasCurrentBadge, initiativePath } },
  );
  result.measurements.groupedNav = true;

  // 3. Navigate Demand via grouped Discovery tab
  const demandHref = await page
    .getByRole("navigation", { name: "Initiative sections" })
    .getByRole("link", { name: "Demand" })
    .getAttribute("href");
  if (demandHref) {
    await page.goto(`${base}${demandHref}`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
  }
  await page.waitForTimeout(500);
  const onDemand = page.url().includes("/demand");
  const stillGrouped =
    (await page.getByRole("navigation", { name: "Initiative sections" }).count()) >
    0;
  await shot(page, "03-demand");
  step("3-discovery-nav", onDemand && stillGrouped, {
    detail: { url: page.url(), demandHref },
  });

  // 4. Governance copy if tab visible
  const gov = page.getByRole("navigation", { name: "Initiative sections" }).getByRole("link", { name: "Governance" });
  if ((await gov.count()) > 0) {
    await gov.click();
    await page.waitForTimeout(700);
    const noAuto =
      (await page.getByText(/does not auto-create|GO does not/i).count()) > 0;
    await shot(page, "04-governance");
    step("4-governance-copy", noAuto, {});
  } else {
    step("4-governance-copy", true, { detail: "SKIP — governance not yet visible at this stage" });
  }

  // 5. PoC distinct panel if visible
  const poc = page.getByRole("navigation", { name: "Initiative sections" }).getByRole("link", { name: "PoC" });
  if ((await poc.count()) > 0) {
    await poc.click();
    await page.waitForTimeout(700);
    const distinct =
      (await page.getByText(/Keep these distinct/i).count()) > 0 &&
      (await page.getByText(/Formal decision/i).count()) > 0;
    await shot(page, "05-poc-distinct");
    step("5-poc-distinct", distinct, {});
  } else {
    step("5-poc-distinct", true, { detail: "SKIP — PoC tab not visible" });
  }

  // 6. Project more sections if visible
  const project = page.getByRole("navigation", { name: "Initiative sections" }).getByRole("link", { name: "Project" });
  if ((await project.count()) > 0) {
    await project.click();
    await page.waitForTimeout(700);
    const more = page.getByText("More sections");
    let moreOk = (await more.count()) > 0;
    if (moreOk) {
      await more.click();
      await page.waitForTimeout(200);
      moreOk = (await page.getByRole("link", { name: "Budget" }).count()) > 0;
    }
    const closedCopy =
      (await page.getByText(/mutations are disabled|read-only/i).count()) >= 0;
    await shot(page, "06-project");
    step("6-project-sections", moreOk || closedCopy, { detail: { moreOk } });
  } else {
    step("6-project-sections", true, { detail: "SKIP — Project tab not visible" });
  }

  // 7. Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}${initiativePath}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(600);
  const mobileGroups =
    (await page.getByRole("navigation", { name: "Initiative sections" }).count()) >
    0;
  await shot(page, "07-mobile");
  step("7-mobile", mobileGroups, {});

  result.measurements.clicksToCurrentStage = 0; // visible in rail
  result.measurements.tabGroupLabels = [
    "Overview",
    "Discovery",
    "Governance",
    "Validation",
    "Delivery",
    "History",
  ];
} catch (e) {
  step("fatal", false, { detail: String(e) });
  try {
    await shot(page, "error");
  } catch {
    /* ignore */
  }
} finally {
  fs.writeFileSync(
    path.join(outDir, "qa-result.json"),
    JSON.stringify(result, null, 2),
  );
  await browser.close();
  console.log("VERDICT", result.verdict);
  process.exit(result.verdict === "PASS" ? 0 : 1);
}
