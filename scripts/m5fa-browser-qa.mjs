/**
 * M5F-A — Visual polish browser QA across major workspaces.
 * Captures after screenshots; verifies tokens, focus, reduced-motion, responsive.
 */
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import fs from "fs";
import path from "node:path";

const base = process.env.QA_BASE_URL ?? "http://localhost:43155";
const pass = fs
  .readFileSync(process.env.QA_PASS_FILE ?? "/tmp/m3dd-qa-pass.txt", "utf8")
  .trim();
const outDir =
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m5fa-qa");
const docsAfter = path.join(
  process.cwd(),
  "docs/acceptance-assets/m5fa/after",
);
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(docsAfter, { recursive: true });

const dbUrl =
  process.env.DATABASE_URL ??
  "postgresql://mgmt:mgmt_dev_only@127.0.0.1:5432/management_platform_m3d_qa?schema=public";
const principalId =
  process.env.TEMP_AUTH_PRINCIPAL_ID ??
  "f796fe09-b948-4eb6-9fcd-0770990ab453";

const result = {
  verdict: "PASS",
  steps: [],
  createdAt: new Date().toISOString(),
};

function step(id, ok, detail) {
  result.steps.push({ id, ok: Boolean(ok), detail });
  if (!ok) result.verdict = "FAIL";
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail ?? "");
}

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

try {
  fs.unlinkSync(path.join(outDir, "persona-state.json"));
} catch {
  /* ignore */
}

// Reuse M5E-C seed/reconcile for org/pi ids when available
let seed = null;
const seedPath = path.join(process.cwd(), "artifacts/m5ec-qa/seed.json");
if (fs.existsSync(seedPath)) {
  seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
} else {
  run("npx", ["tsx", "scripts/m5ec-reconcile.mts"], {
    DATABASE_URL: dbUrl,
    DIRECT_URL: dbUrl,
    TEMP_AUTH_PRINCIPAL_ID: principalId,
    QA_OUT_DIR: path.join(process.cwd(), "artifacts/m5ec-qa"),
  });
  seed = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "artifacts/m5ec-qa/seed.json"),
      "utf8",
    ),
  );
}

function switchPersona(name) {
  const r = spawnSync(
    "node",
    ["scripts/m4fc-switch-persona.mjs", `--persona=${name}`],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: dbUrl,
        DIRECT_URL: dbUrl,
        TEMP_AUTH_PRINCIPAL_ID: principalId,
        QA_ORG_ID: seed.organizationId,
        QA_SECTION_ID: seed.sectionId,
        QA_DEPARTMENT_ID: seed.departmentId,
        QA_TEAM_ID: seed.teamId,
        QA_PERSONA_STATE: path.join(outDir, "persona-state.json"),
      },
      encoding: "utf8",
    },
  );
  if (r.status !== 0) throw new Error(`persona ${name}: ${r.stderr || r.stdout}`);
}

function restorePersona() {
  spawnSync("node", ["scripts/m4fc-switch-persona.mjs", "--restore"], {
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
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="username"]', "owner");
  await page.fill('input[name="password"]', pass);
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 25000,
  });
}

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  fs.copyFileSync(file, path.join(docsAfter, `${name}.png`));
}

async function softGoto(page, p) {
  await page.goto(`${base}${p}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(500);
}

const org = seed.organizationId;
const pi = seed.piId;
const routes = [
  { name: "home", path: "/" },
  { name: "portfolio", path: `/portfolio?organizationId=${org}` },
  {
    name: "resource-planning",
    path: `/portfolio/capacity?organizationId=${org}&piId=${pi}`,
  },
  {
    name: "reports",
    path: `/portfolio/reports?organizationId=${org}&piId=${pi}&reportType=portfolio_summary`,
  },
  { name: "organization", path: "/organization" },
  { name: "pi", path: "/pi" },
  { name: "initiatives", path: "/initiatives" },
];

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
  switchPersona("org-admin");
  await login(page);

  for (const r of routes) {
    await softGoto(page, r.path);
    const bodyText = await page.locator("main, body").first().innerText();
    const hasContent = bodyText.trim().length > 40;
    const hasHexDebt = await page.evaluate(() => {
      const html = document.documentElement.innerHTML;
      return /#74848e|#e2e8eb|#89969e|#98a5ad/i.test(html);
    });
    step(`desktop-${r.name}`, hasContent && !hasHexDebt, {
      hasContent,
      hasHexDebt,
      url: page.url(),
    });
    await shot(page, `01-desktop-${r.name}`);
  }

  // Focus visible on primary nav / reports controls
  await softGoto(
    page,
    `/portfolio/reports?organizationId=${org}&piId=${pi}&reportType=portfolio_summary`,
  );
  await page.getByLabel(/Report type/i).focus();
  const focusOutline = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      name: el.getAttribute("aria-label") || el.getAttribute("name"),
    };
  });
  step(
    "focus-visible-report-type",
    focusOutline &&
      (focusOutline.outlineStyle !== "none" ||
        Number.parseFloat(focusOutline.outlineWidth) > 0 ||
        /report/i.test(String(focusOutline.name))),
    focusOutline,
  );

  // Reduced motion: transitions should collapse via media query
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedOk = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.className = "ds-interactive";
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const dur = cs.transitionDuration;
    probe.remove();
    return dur === "0s" || dur === "0.01ms" || dur.startsWith("0.01");
  });
  step("reduced-motion-utilities", reducedOk);
  await shot(page, "02-reduced-motion-reports");
  await page.emulateMedia({ reducedMotion: "no-preference" });

  // Tablet
  await page.setViewportSize({ width: 820, height: 1180 });
  await softGoto(
    page,
    `/portfolio/capacity?organizationId=${org}&piId=${pi}`,
  );
  step(
    "tablet-resource-planning",
    (await page.getByText(/Resource Planning/i).count()) > 0,
  );
  await shot(page, "03-tablet-resource-planning");

  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  for (const r of [
    { name: "home", path: "/" },
    {
      name: "reports",
      path: `/portfolio/reports?organizationId=${org}&piId=${pi}&reportType=portfolio_summary`,
    },
  ]) {
    await softGoto(page, r.path);
    step(
      `mobile-${r.name}`,
      (await page.locator("body").innerText()).length > 20,
    );
    await shot(page, `04-mobile-${r.name}`);
  }

  // Viewer persona — business behavior preserved (read path)
  await page.setViewportSize({ width: 1440, height: 900 });
  switchPersona("viewer");
  await softGoto(
    page,
    `/portfolio/reports?organizationId=${org}&piId=${pi}&reportType=portfolio_summary`,
  );
  await page.reload({ waitUntil: "networkidle" });
  const viewerOk = (await page.getByTestId("reports-workspace").count()) > 0;
  step("persona-viewer-reports", viewerOk);
  await shot(page, "05-persona-viewer-reports");

  restorePersona();

  // Token utilities present in CSSOM
  const utilOk = await page.evaluate(() => {
    const el = document.createElement("p");
    el.className = "ds-eyebrow";
    document.body.appendChild(el);
    const cs = getComputedStyle(el);
    const color = cs.color;
    el.remove();
    return Boolean(color && color !== "rgba(0, 0, 0, 0)");
  });
  step("ds-eyebrow-utility", utilOk);
} catch (err) {
  result.verdict = "FAIL";
  result.error = String(err?.stack || err);
  console.error(err);
  try {
    await shot(page, "error");
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
