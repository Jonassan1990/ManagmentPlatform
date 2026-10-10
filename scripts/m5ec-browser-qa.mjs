/**
 * M5E-C — Resource / KPI / Reporting acceptance browser QA.
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
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m5ec-qa");
const docsShotDir = path.join(
  process.cwd(),
  "docs/acceptance-assets/m5ec/screenshots",
);
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(docsShotDir, { recursive: true });

const dbUrl =
  process.env.DATABASE_URL ??
  "postgresql://mgmt:mgmt_dev_only@127.0.0.1:5432/management_platform_m3d_qa?schema=public";
const principalId =
  process.env.TEMP_AUTH_PRINCIPAL_ID ??
  "f796fe09-b948-4eb6-9fcd-0770990ab453";

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

run("npx", ["tsx", "scripts/m5ec-reconcile.mts"], {
  DATABASE_URL: dbUrl,
  DIRECT_URL: dbUrl,
  TEMP_AUTH_PRINCIPAL_ID: principalId,
  QA_OUT_DIR: outDir,
});

const seed = JSON.parse(fs.readFileSync(path.join(outDir, "seed.json"), "utf8"));
const reconcile = JSON.parse(
  fs.readFileSync(path.join(outDir, "reconcile.json"), "utf8"),
);

const result = {
  milestone: "M5E-C",
  base,
  generatedAt: new Date().toISOString(),
  startingMainHint: "8eabe5c",
  seed,
  reconcileVerdict: reconcile.verdict,
  steps: [],
  personas: [],
  verdict: reconcile.verdict === "PASS" ? "PASS" : "FAIL",
};

function step(name, ok, extra = {}) {
  result.steps.push({ step: name, status: ok ? "PASS" : "FAIL", ...extra });
  if (!ok) result.verdict = "FAIL";
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`, extra.detail ?? "");
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
  fs.copyFileSync(file, path.join(docsShotDir, `${name}.png`));
}

async function softGoto(page, p) {
  await page.goto(`${base}${p}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(700);
}

const capacityUrl = `/portfolio/capacity?organizationId=${seed.organizationId}&piId=${seed.piId}`;
const reportsUrl = `/portfolio/reports?organizationId=${seed.organizationId}&piId=${seed.piId}&reportType=pi_capacity`;

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

try {
  step("0-reconcile", reconcile.verdict === "PASS", {
    detail: reconcile.checks?.filter((c) => !c.ok).map((c) => c.id),
  });

  switchPersona("org-admin");
  await login(page);

  await softGoto(page, capacityUrl);
  const resourcePlanning =
    (await page.getByText(/Resource Planning/i).count()) > 0 &&
    (await page.getByTestId("capacity-summary").count()) > 0;
  step("1-resource-planning", resourcePlanning);
  await shot(page, "01-resource-planning");

  await softGoto(page, reportsUrl);
  const reportAsOf = (await page.getByTestId("report-as-of").count()) > 0;
  const printBtn = (await page.getByTestId("report-print").count()) > 0;
  const exportBtn = (await page.getByTestId("report-export-csv").count()) > 0;
  step("2-report-preview-export-print", reportAsOf && printBtn && exportBtn, {
    detail: { reportAsOf, printBtn, exportBtn },
  });
  await shot(page, "02-report-capacity");

  // CSV matches preview KPI presence
  const cookies = await context.cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const csvRes = await fetch(
    `${base}/api/reports/export?organizationId=${seed.organizationId}&piId=${seed.piId}&reportType=pi_capacity`,
    { headers: { cookie: cookieHeader } },
  );
  const csv = await csvRes.text();
  step(
    "3-csv-export",
    csvRes.ok && csv.includes("asOf") && csv.includes("availableHours"),
    { detail: csvRes.status },
  );
  step("4-csv-injection-safe", !/(^|,)=[A-Z]/.test(csv));

  // Unauthorized export
  const bad = await fetch(
    `${base}/api/reports/export?organizationId=00000000-0000-4000-8000-000000000099&reportType=portfolio_summary`,
    { headers: { cookie: cookieHeader } },
  );
  step("5-unauthorized-export", bad.status === 403 || bad.status === 400, {
    detail: bad.status,
  });

  // Personas
  for (const persona of ["viewer", "department-manager"]) {
    switchPersona(persona);
    await softGoto(page, reportsUrl);
    await page.reload({ waitUntil: "networkidle" });
    const ok = (await page.getByTestId("reports-workspace").count()) > 0;
    result.personas.push({ persona, status: ok ? "PASS" : "FAIL" });
    if (!ok) result.verdict = "FAIL";
    await shot(page, `persona-${persona}`);
    step(`persona-${persona}`, ok);
  }

  restorePersona();
  await page.setViewportSize({ width: 390, height: 844 });
  await softGoto(page, reportsUrl);
  const mobileOk =
    (await page.getByTestId("reports-filters").count()) > 0 &&
    (await page.getByLabel(/Report type/i).count()) > 0;
  step("6-mobile-a11y-controls", mobileOk);
  await shot(page, "03-mobile");

  // Keyboard: report type select focusable
  await page.getByLabel(/Report type/i).focus();
  const focused = await page.evaluate(
    () => document.activeElement?.getAttribute("aria-label") || document.activeElement?.name,
  );
  step("7-keyboard-focus-report-type", /report/i.test(String(focused)) || focused === "reportType", {
    detail: focused,
  });
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
  fs.writeFileSync(
    path.join(outDir, "qa-result.json"),
    JSON.stringify(result, null, 2),
  );
  await browser.close();
  console.log(JSON.stringify({ verdict: result.verdict, steps: result.steps.length }, null, 2));
  if (result.verdict !== "PASS") process.exit(1);
}
