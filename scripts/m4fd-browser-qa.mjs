/**
 * M4F-D Browser QA — cross-application UX hardening regression.
 * Org Admin temp-auth + Viewer persona swap for org read-only.
 * Viewports: 360, 390, 768, 1024, 1440. Non-destructive.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const base = process.env.QA_BASE_URL ?? "http://localhost:43148";
const pass = fs
  .readFileSync(process.env.QA_PASS_FILE ?? "/tmp/m3dd-qa-pass.txt", "utf8")
  .trim();
const outDir =
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m4fd-qa");
fs.mkdirSync(outDir, { recursive: true });
const docsShotDir = path.join(
  process.cwd(),
  "docs/acceptance-assets/m4fd/screenshots",
);
fs.mkdirSync(docsShotDir, { recursive: true });

const seededOrg =
  process.env.QA_ORG_ID ?? "f6b317a2-839d-413b-9aa1-2ea4e006f486";
const seededPi =
  process.env.QA_PI_ID ?? "c9cf896f-8a37-43de-aefe-c3af32bcfc78";

const viewports = [
  { name: "360", width: 360, height: 740 },
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1440", width: 1440, height: 900 },
];

const routes = [
  { key: "home", path: "/" },
  { key: "initiatives", path: "/initiatives" },
  { key: "portfolio", path: `/portfolio?organizationId=${seededOrg}` },
  {
    key: "capacity",
    path: `/portfolio/capacity?organizationId=${seededOrg}&piId=${seededPi}`,
  },
  { key: "pi-board", path: `/pi/${seededPi}` },
  { key: "pi-review", path: `/pi/${seededPi}/review` },
  { key: "pi-compare", path: `/pi/${seededPi}/compare` },
  { key: "organization", path: `/organization/${seededOrg}` },
  { key: "approvals", path: "/approvals" },
];

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const result = {
  milestone: "M4F-D",
  base,
  generatedAt: new Date().toISOString(),
  steps: [],
  viewports: [],
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
}

async function overflowCheck(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      overflowX: doc.scrollWidth > doc.clientWidth + 2,
    };
  });
}

function switchPersona(persona) {
  const r = spawnSync(
    "node",
    ["scripts/m4fc-switch-persona.mjs", `--persona=${persona}`],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: process.env,
    },
  );
  if (r.status !== 0) {
    throw new Error(`persona apply ${persona} failed: ${r.stderr || r.stdout}`);
  }
}

function restorePersona() {
  spawnSync("node", ["scripts/m4fc-switch-persona.mjs", "--restore"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
  });
}

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();

try {
  await login(page);
  step("login", true);

  // Cross-module smoke @1440
  for (const route of routes) {
    await page.goto(`${base}${route.path}`, { waitUntil: "networkidle" });
    const status = page.url().includes("/login") ? false : true;
    step(`route:${route.key}`, status, { path: route.path });
    await shot(page, `01-${route.key}`);
  }

  // Touch / caption smoke on initiatives
  await page.goto(`${base}/initiatives`, { waitUntil: "networkidle" });
  const chip = page.locator('a[href="/initiatives"]').filter({ hasText: "All" }).first();
  const chipBox = await chip.boundingBox();
  step(
    "initiatives-filter-chip-min-height",
    chipBox != null && chipBox.height >= 40,
    { height: chipBox?.height },
  );
  const caption = await page.locator("table caption").count();
  step("initiatives-table-caption", caption >= 1, { caption });

  // Org manage forms visible for admin
  await page.goto(`${base}/organization/${seededOrg}`, {
    waitUntil: "networkidle",
  });
  const editOrg = await page.getByRole("heading", {
    name: /Edit organization/i,
  }).count();
  step("org-admin-edit-visible", editOrg >= 1);

  // Viewer: mutate panels hidden
  try {
    switchPersona("viewer");
    await page.goto(`${base}/organization/${seededOrg}`, {
      waitUntil: "networkidle",
    });
    await shot(page, "02-org-viewer-readonly");
    const editAsViewer = await page.getByRole("heading", {
      name: /Edit organization/i,
    }).count();
    const readonlyNotice = await page
      .getByText(/Organization structure manage permission/i)
      .count();
    step("org-viewer-edit-hidden", editAsViewer === 0);
    step("org-viewer-readonly-notice", readonlyNotice >= 1);

    await page.goto(`${base}/initiatives`, { waitUntil: "networkidle" });
    const newInit = await page.getByRole("link", { name: /New initiative/i }).count();
    step("viewer-no-new-initiative", newInit === 0);
  } finally {
    restorePersona();
  }

  // Responsive matrix on home + capacity + org
  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const samples = [
      { key: "home", path: "/" },
      {
        key: "capacity",
        path: `/portfolio/capacity?organizationId=${seededOrg}&piId=${seededPi}`,
      },
      { key: "organization", path: `/organization/${seededOrg}` },
      { key: "pi-review", path: `/pi/${seededPi}/review` },
    ];
    const vpResult = { viewport: vp.name, samples: [] };
    for (const sample of samples) {
      await page.goto(`${base}${sample.path}`, { waitUntil: "networkidle" });
      const overflow = await overflowCheck(page);
      const ok = !overflow.overflowX;
      vpResult.samples.push({
        route: sample.key,
        overflowX: overflow.overflowX,
        scrollWidth: overflow.scrollWidth,
        clientWidth: overflow.clientWidth,
      });
      step(`viewport-${vp.name}-${sample.key}`, ok, {
        detail: overflow.overflowX
          ? `overflow ${overflow.scrollWidth}>${overflow.clientWidth}`
          : undefined,
      });
      if (vp.name === "360" || vp.name === "1440") {
        await shot(page, `vp-${vp.name}-${sample.key}`);
      }
    }
    result.viewports.push(vpResult);
  }

  // Skip link + main landmark
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  const skip = await page.evaluate(() => {
    const el = document.activeElement;
    return el?.textContent?.trim() ?? "";
  });
  step("skip-link-focus", /skip/i.test(skip), { focused: skip });
} catch (err) {
  result.verdict = "FAIL";
  result.error = String(err);
  console.error(err);
  try {
    await shot(page, "error");
  } catch {
    /* ignore */
  }
} finally {
  restorePersona();
  await browser.close();
  const reportPath = path.join(outDir, "report.json");
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
  fs.copyFileSync(
    reportPath,
    path.join(docsShotDir, "..", "qa-report.json"),
  );
  console.log("VERDICT", result.verdict);
  process.exit(result.verdict === "PASS" ? 0 : 1);
}
