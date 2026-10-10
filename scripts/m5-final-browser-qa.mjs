/**
 * M5-FINAL — Representative regression journeys (Org Admin) + timing samples.
 * Audit/acceptance only — reuses seeded M5E fixtures.
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
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m5-final-qa");
const docsShotDir = path.join(
  process.cwd(),
  "docs/acceptance-assets/m5-final/screenshots",
);
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(docsShotDir, { recursive: true });

const dbUrl =
  process.env.DATABASE_URL ??
  "postgresql://mgmt:mgmt_dev_only@127.0.0.1:5432/management_platform_m3d_qa?schema=public";
const principalId =
  process.env.TEMP_AUTH_PRINCIPAL_ID ??
  "f796fe09-b948-4eb6-9fcd-0770990ab453";

const result = {
  milestone: "M5-FINAL",
  base,
  generatedAt: new Date().toISOString(),
  journeys: [],
  timings: {},
  steps: [],
  verdict: "PASS",
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
step("reconcile", reconcile.verdict === "PASS", {
  passed: reconcile.passed,
  total: reconcile.total,
});

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

async function timedGoto(page, p) {
  const t0 = Date.now();
  await page.goto(`${base}${p}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(300);
  const ms = Date.now() - t0;
  return ms;
}

async function okPage(page) {
  const body = await page.locator("body").innerText();
  return (
    body.trim().length > 30 &&
    !/Application error|Internal Server Error/i.test(body)
  );
}

const org = seed.organizationId;
const pi = seed.piId;

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  switchPersona("org-admin");
  await login(page);

  const journeys = [
    { id: "home", path: "/", expect: /Quick Start|My Work|Needs Attention|Home/i },
    {
      id: "portfolio-kpis",
      path: `/portfolio?organizationId=${org}`,
      expect: /Portfolio|Initiative|Project/i,
    },
    { id: "initiatives", path: "/initiatives", expect: /Initiative/i },
    { id: "approvals", path: "/approvals", expect: /Approval|Governance|Decision/i },
    {
      id: "explorer",
      path: `/portfolio/explorer?organizationId=${org}`,
      expect: /Explorer|Project|Delivery/i,
    },
    { id: "pi-list", path: "/pi", expect: /Program Increment|PI|Planning/i },
    {
      id: "pi-board",
      path: `/pi/${pi}/board`,
      expect: /Board|Backlog|Scenario|Work/i,
    },
    {
      id: "resource-planning",
      path: `/portfolio/capacity?organizationId=${org}&piId=${pi}`,
      expect: /Resource Planning|Capacity|Utilization/i,
    },
    {
      id: "reports",
      path: `/portfolio/reports?organizationId=${org}&piId=${pi}&reportType=portfolio_summary`,
      expect: /Report|Portfolio Summary|As of/i,
      testId: "reports-workspace",
    },
    { id: "organization", path: "/organization", expect: /Organization/i },
  ];

  for (const j of journeys) {
    const ms = await timedGoto(page, j.path);
    result.timings[j.id] = ms;
    const body = await page.locator("body").innerText();
    const textOk = j.expect.test(body);
    const tidOk = j.testId
      ? (await page.getByTestId(j.testId).count()) > 0
      : true;
    const alive = await okPage(page);
    const passJ = textOk && tidOk && alive;
    result.journeys.push({
      journey: j.id,
      path: j.path,
      url: page.url(),
      ms,
      status: passJ ? "PASS" : "FAIL",
      snippet: body.slice(0, 160).replace(/\s+/g, " "),
    });
    step(`journey-${j.id}`, passJ, {
      ms,
      textOk,
      tidOk,
      url: page.url(),
      snippet: body.slice(0, 120).replace(/\s+/g, " "),
    });
    await shot(page, `01-${j.id}`);
  }

  // Viewer smoke
  switchPersona("viewer");
  await timedGoto(page, "/");
  await page.reload({ waitUntil: "networkidle" });
  const viewerHome = await okPage(page);
  step("persona-viewer-home", viewerHome);
  await shot(page, "02-viewer-home");

  // Unbound
  switchPersona("unbound");
  await timedGoto(page, "/");
  await page.reload({ waitUntil: "networkidle" });
  const unboundOk = /access-not-configured/.test(page.url());
  step("persona-unbound", unboundOk, { url: page.url() });
  await shot(page, "03-unbound");

  // Mobile home + reports
  restorePersona();
  switchPersona("org-admin");
  await page.setViewportSize({ width: 390, height: 844 });
  await timedGoto(page, "/");
  step("mobile-home", await okPage(page));
  await shot(page, "04-mobile-home");
  await timedGoto(
    page,
    `/portfolio/reports?organizationId=${org}&reportType=portfolio_summary`,
  );
  step(
    "mobile-reports",
    (await page.getByTestId("reports-filters").count()) > 0,
  );
  await shot(page, "05-mobile-reports");

  fs.writeFileSync(
    path.join(docsShotDir, "timings.json"),
    JSON.stringify(result.timings, null, 2),
  );
  fs.writeFileSync(
    path.join(outDir, "timings.json"),
    JSON.stringify(result.timings, null, 2),
  );
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
  console.log("TIMINGS", JSON.stringify(result.timings));
  process.exitCode = result.verdict === "PASS" ? 0 : 1;
}
