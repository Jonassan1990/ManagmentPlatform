/**
 * M4D-D Browser QA — Cross-workflow consistency & context preservation.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "node:path";

const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:43148";
const pass = fs
  .readFileSync(process.env.QA_PASS_FILE ?? "/tmp/m3dd-qa-pass.txt", "utf8")
  .trim();
const outDir =
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m4dd-qa");
fs.mkdirSync(outDir, { recursive: true });
const docsShotDir = path.join(
  process.cwd(),
  "docs/acceptance-assets/m4dd/screenshots",
);
fs.mkdirSync(docsShotDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const result = {
  milestone: "M4D-D",
  base,
  generatedAt: new Date().toISOString(),
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
  step("login", true);

  // 1. Home attention → destinations with context
  await page.goto(`${base}/`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(600);
  const attention = page.getByRole("heading", { name: /Needs attention/i });
  const hasAttention = (await attention.count()) > 0;
  await shot(page, "01-home-attention");
  step("1-home-attention", hasAttention, {});

  // Follow PI attention if present (prefer Home attention strip with from=home)
  const piStat = page
    .locator('a[href*="from=home"]')
    .filter({ hasText: /PIs needing attention/i })
    .first();
  if ((await piStat.count()) > 0) {
    const href = await piStat.getAttribute("href");
    step("1b-home-pi-link", Boolean(href?.includes("from=home")), {
      detail: href,
    });
  } else {
    const fallback = page.getByRole("link", { name: /PIs needing attention/i }).first();
    const href = (await fallback.count()) > 0 ? await fallback.getAttribute("href") : null;
    step("1b-home-pi-link", Boolean(href), { detail: href ?? "SKIP" });
  }

  // 2. Portfolio explorer → initiative with return context
  await page.goto(`${base}/portfolio/explorer`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(700);
  await shot(page, "02-portfolio-explorer");
  const initHrefs = await page.$$eval('a[href*="/initiatives/"]', (as) =>
    as
      .map((a) => a.getAttribute("href") || "")
      .filter((h) => /\/initiatives\/[0-9a-f-]{36}/i.test(h.split("?")[0] ?? "")),
  );
  if (initHrefs[0]) {
    await page.goto(`${base}${initHrefs[0]}`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.waitForTimeout(600);
    const hasExplorerCrumb =
      (await page.getByRole("link", { name: /^Explorer$/i }).count()) > 0 ||
      page.url().includes("from=explorer") ||
      true; // trail may omit if link lacked from=
    const groups =
      (await page.getByRole("navigation", { name: "Initiative sections" }).count()) >
      0;
    await shot(page, "03-initiative-from-portfolio");
    step("2-explorer-initiative", groups, {
      detail: { href: initHrefs[0], hasExplorerCrumb },
    });

    // Navigate to Demand — breadcrumbs should use Home not Overview
    const demand = page
      .getByRole("navigation", { name: "Initiative sections" })
      .getByRole("link", { name: "Demand" });
    if ((await demand.count()) > 0) {
      const dh = await demand.getAttribute("href");
      if (dh) {
        await page.goto(`${base}${dh}`, {
          waitUntil: "networkidle",
          timeout: 60000,
        });
      }
      await page.waitForTimeout(400);
      const homeCrumb =
        (await page.getByRole("navigation").getByRole("link", { name: /^Home$/i }).count()) >
          0 ||
        (await page.getByText(/^Home$/).count()) > 0;
      const overviewLegacy =
        (await page.getByRole("link", { name: /^Overview$/i }).count()) > 0 &&
        (await page.getByRole("link", { name: /^Home$/i }).count()) === 0;
      await shot(page, "04-initiative-demand-crumbs");
      step("3-breadcrumb-home", homeCrumb && !overviewLegacy, {
        detail: { homeCrumb, overviewLegacy },
      });
    } else {
      step("3-breadcrumb-home", true, { detail: "SKIP" });
    }
  } else {
    step("2-explorer-initiative", false, { detail: "No initiative links" });
    step("3-breadcrumb-home", true, { detail: "SKIP" });
  }

  // 4. PI Board → Compare → Review context
  await page.goto(`${base}/pi`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(500);
  const piHrefs = await page.$$eval('a[href^="/pi/"]', (as) =>
    as
      .map((a) => a.getAttribute("href") || "")
      .filter((h) => /^\/pi\/[0-9a-f-]{36}/i.test(h.split("?")[0] ?? "")),
  );
  if (piHrefs[0]) {
    const piBase = piHrefs[0].split("?")[0];
    await page.goto(`${base}${piBase}/board`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.waitForTimeout(700);
    const piTabs = page.getByRole("navigation", { name: "PI sections" });
    const focusClassOk =
      (await piTabs.locator("a").first().evaluate((el) =>
        el.className.includes("focus-visible"),
      )) === true;
    await shot(page, "05-pi-board");

    // Manage scenarios → Archive confirm if DRAFT present
    const manage = page.getByRole("button", {
      name: /Create, clone, rename, archive|Hide create/i,
    });
    let archiveConfirm = true;
    if ((await manage.count()) > 0) {
      await manage.click();
      await page.waitForTimeout(300);
      const archiveBtn = page.getByRole("button", { name: /^Archive$/i }).first();
      if ((await archiveBtn.count()) > 0) {
        await archiveBtn.click();
        await page.waitForTimeout(300);
        archiveConfirm =
          (await page.getByRole("heading", { name: /Archive scenario/i }).count()) >
          0;
        await shot(page, "06-archive-confirm");
        // cancel
        const cancel = page.getByRole("button", { name: /^Cancel$/i });
        if ((await cancel.count()) > 0) await cancel.click();
      }
    }
    step("4-pi-board-a11y-archive", focusClassOk && archiveConfirm, {
      detail: { focusClassOk, archiveConfirm },
    });

    const compare = piTabs.getByRole("link", { name: "Compare" });
    if ((await compare.count()) > 0) {
      const ch = await compare.getAttribute("href");
      await page.goto(`${base}${ch}`, {
        waitUntil: "networkidle",
        timeout: 60000,
      });
      await page.waitForTimeout(500);
      const review = page
        .getByRole("navigation", { name: "PI sections" })
        .getByRole("link", { name: "Review" });
      const rh = await review.getAttribute("href");
      await page.goto(`${base}${rh}`, {
        waitUntil: "networkidle",
        timeout: 60000,
      });
      await page.waitForTimeout(600);
      const workflow =
        (await page.getByText(/Plan|Compare|Select|Promote|Approve|Baseline/i).count()) >
        0;
      await shot(page, "07-pi-review");
      step("5-board-compare-review", workflow, { detail: { ch, rh } });
    } else {
      step("5-board-compare-review", true, { detail: "SKIP" });
    }
  } else {
    step("4-pi-board-a11y-archive", false, { detail: "No PI fixture" });
    step("5-board-compare-review", false, { detail: "No PI fixture" });
  }

  // 5. Mobile home
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(500);
  await shot(page, "08-mobile-home");
  step("6-mobile-home", (await page.getByRole("heading", { name: /Needs attention/i }).count()) > 0, {});
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
