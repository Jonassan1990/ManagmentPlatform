/**
 * M5E-B — Reports preview / CSV / print / persona browser QA.
 */
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import fs from "fs";
import path from "node:path";

const base = process.env.QA_BASE_URL ?? "http://localhost:43156";
const pass = fs
  .readFileSync(process.env.QA_PASS_FILE ?? "/tmp/m3dd-qa-pass.txt", "utf8")
  .trim();
const outDir =
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m5eb-qa");
const docsShotDir = path.join(
  process.cwd(),
  "docs/acceptance-assets/m5eb/screenshots",
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

run("npx", ["tsx", "scripts/m5eb-seed-browser.mts"], {
  DATABASE_URL: dbUrl,
  DIRECT_URL: dbUrl,
  TEMP_AUTH_PRINCIPAL_ID: principalId,
  QA_OUT_DIR: outDir,
});

const seed = JSON.parse(fs.readFileSync(path.join(outDir, "seed.json"), "utf8"));

const result = {
  milestone: "M5E-B",
  base,
  generatedAt: new Date().toISOString(),
  seed,
  steps: [],
  personas: [],
  verdict: "PASS",
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
  if (r.status !== 0) {
    throw new Error(`persona ${name}: ${r.stderr || r.stdout}`);
  }
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
  if (page.url().includes("access-not-configured")) {
    throw new Error(`login access-not-configured: ${page.url()}`);
  }
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

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
});
const page = await context.newPage();

try {
  switchPersona("org-admin");
  await login(page);
  step("1-login", true);

  await softGoto(page, seed.paths.reports);
  const branding =
    (await page.getByRole("heading", { name: /^Reports$/i }).count()) > 0;
  const nav =
    (await page
      .getByRole("navigation", { name: /Primary/i })
      .getByRole("link", { name: /^Reports$/i })
      .count()) > 0;
  step("2-reports-entry", branding && nav, { detail: { branding, nav } });

  const preview =
    (await page.getByTestId("reports-preview").count()) > 0 ||
    (await page.getByTestId("report-kpis").count()) > 0 ||
    (await page.getByText(/As of/i).count()) > 0;
  const asOf = (await page.getByTestId("report-as-of").count()) > 0;
  step("3-preview-as-of", preview && asOf);

  await softGoto(page, seed.paths.capacityReport);
  const capacityReady =
    (await page.getByTestId("report-table").count()) > 0 ||
    (await page.getByText(/Select a Program Increment|UNAVAILABLE|No rows/i).count()) >
      0 ||
    (await page.getByTestId("report-kpis").count()) > 0;
  step("4-pi-capacity-report", capacityReady);
  await shot(page, "01-capacity-report");

  await softGoto(page, seed.paths.resourceReport);
  step(
    "5-resource-allocation-report",
    (await page.getByTestId("reports-preview").count()) > 0,
  );

  // CSV export via API with session cookies
  const cookies = await context.cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const csvRes = await fetch(`${base}${seed.paths.capacityExport}`, {
    headers: { cookie: cookieHeader },
  });
  const csvText = await csvRes.text();
  const csvOk =
    csvRes.ok &&
    csvRes.headers.get("content-type")?.includes("text/csv") &&
    csvText.includes("asOf") &&
    !csvText.includes(",0\r\nUNAVAILABLE"); // soft check
  const injectionSafe = !/(^|,)=CMD\(/.test(csvText);
  step("6-csv-export", csvOk && injectionSafe, {
    detail: { status: csvRes.status, len: csvText.length, injectionSafe },
  });
  fs.writeFileSync(path.join(outDir, "sample-capacity.csv"), csvText);

  // Cross-org denial: random org uuid
  const denyRes = await fetch(
    `${base}/api/reports/export?organizationId=00000000-0000-4000-8000-000000000099&reportType=portfolio_summary`,
    { headers: { cookie: cookieHeader } },
  );
  step("7-cross-org-denial", denyRes.status === 403 || denyRes.status === 400, {
    detail: denyRes.status,
  });

  // Print control present
  await softGoto(page, seed.paths.reports);
  step(
    "8-print-control",
    (await page.getByTestId("report-print").count()) > 0,
  );
  await shot(page, "02-portfolio-summary");

  // Viewer persona
  switchPersona("viewer");
  await softGoto(page, seed.paths.reports);
  await page.reload({ waitUntil: "networkidle" });
  const viewerOk =
    (await page.getByTestId("reports-workspace").count()) > 0 &&
    (await page.getByText(/Reports/i).count()) > 0;
  result.personas.push({
    persona: "viewer",
    status: viewerOk ? "PASS" : "FAIL",
  });
  if (!viewerOk) result.verdict = "FAIL";
  await shot(page, "persona-viewer");
  step("9-viewer", viewerOk);

  // Department manager scoped
  switchPersona("department-manager");
  await softGoto(page, seed.paths.reports);
  await page.reload({ waitUntil: "networkidle" });
  const deptOk = (await page.getByTestId("reports-workspace").count()) > 0;
  result.personas.push({
    persona: "department-manager",
    status: deptOk ? "PASS" : "FAIL",
  });
  if (!deptOk) result.verdict = "FAIL";
  await shot(page, "persona-department-manager");
  step("10-department-manager", deptOk);

  restorePersona();
  await page.setViewportSize({ width: 390, height: 844 });
  await softGoto(page, seed.paths.reports);
  step(
    "11-mobile",
    (await page.getByTestId("reports-workspace").count()) > 0,
  );
  await shot(page, "03-mobile");
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
