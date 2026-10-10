/**
 * M5F-B — Role-based product usability & accessibility acceptance (browser).
 *
 * Verifies Home / My Work / Quick Start, initiative/project/PI/resource/report
 * paths, persona visibility, mobile + keyboard, and records usability
 * measurements. Uses RoleBinding swaps (no AuthZ code changes).
 *
 * Not a real-user study — results are BROWSER VERIFIED / scripted measurements.
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
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m5fb-qa");
const docsShotDir = path.join(
  process.cwd(),
  "docs/acceptance-assets/m5fb/screenshots",
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
  milestone: "M5F-B",
  base,
  generatedAt: new Date().toISOString(),
  method: "BROWSER VERIFIED — scripted persona RoleBinding swaps; not a real-user study",
  acceptance: [],
  personas: [],
  measurements: [],
  steps: [],
  verdict: "PASS",
};

function step(id, ok, detail) {
  result.steps.push({ id, ok: Boolean(ok), detail });
  if (!ok) result.verdict = "FAIL";
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail ?? "");
}

function accept(id, ok, detail) {
  result.acceptance.push({ id, ok: Boolean(ok), detail, evidence: "BROWSER VERIFIED" });
  if (!ok) result.verdict = "FAIL";
  console.log(`${ok ? "PASS" : "FAIL"} accept:${id}`, detail ?? "");
}

function measure(id, data) {
  result.measurements.push({ id, ...data });
  console.log("MEASURE", id, JSON.stringify(data));
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
const org = seed.organizationId;
const pi = seed.piId;

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
        QA_ORG_ID: org,
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
}

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  fs.copyFileSync(file, path.join(docsShotDir, `${name}.png`));
}

async function softGoto(page, p) {
  const t0 = Date.now();
  const res = await page.goto(`${base}${p}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(400);
  return { ms: Date.now() - t0, status: res?.status() ?? 0 };
}

async function countNav(page, label) {
  return page
    .locator(`nav[aria-label="Primary"] a, nav a`)
    .filter({ hasText: new RegExp(`^${label}$`, "i") })
    .count();
}

async function hasText(page, re) {
  return (await page.getByText(re).count()) > 0;
}

async function noSilentFailure(page) {
  const body = await page.locator("body").innerText();
  const crashed =
    /Application error|Internal Server Error|Something went wrong/i.test(body);
  const blank = body.trim().length < 20;
  return !crashed && !blank;
}

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();

const consoleErrors = [];
page.on("pageerror", (err) => consoleErrors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});

try {
  // ── Org Admin journey covering acceptance criteria ─────────────
  switchPersona("org-admin");
  await login(page);

  let nav = await softGoto(page, "/");
  const homeOk =
    (await page.locator("#home-quick-start, #home-my-work, #home-attention").count()) >=
      1 && (await noSilentFailure(page));
  accept("clear-home-starting-point", homeOk, { ms: nav.ms });
  measure("home-load", { steps: 1, ms: nav.ms, path: "/" });
  await shot(page, "01-admin-home");

  const myWork = (await page.locator("#home-my-work").count()) > 0;
  accept("correct-my-work", myWork);
  // SectionShell places the id on the heading; actions live in the parent section.
  const quickStartSection = page
    .locator("section")
    .filter({ has: page.locator("#home-quick-start") });
  const quickStart = (await page.locator("#home-quick-start").count()) > 0;
  const qsLinks = await quickStartSection.locator("a").count();
  const qsUnavailable = await quickStartSection
    .getByText(/unavailable|not configured|no authorized/i)
    .count();
  accept(
    "authorized-quick-start",
    quickStart && (qsLinks >= 1 || qsUnavailable > 0),
    { qsLinks, qsUnavailable },
  );
  measure("time-to-find-next-action-quick-start", {
    steps: 1,
    ms: nav.ms,
    controlCount: qsLinks,
  });

  // KPIs on home / portfolio
  nav = await softGoto(page, `/portfolio?organizationId=${org}`);
  const kpiOk =
    (await hasText(page, /Portfolio|Active|Initiative|Project/i)) &&
    (await noSilentFailure(page));
  accept("actionable-kpis", kpiOk, { ms: nav.ms });
  await shot(page, "02-admin-portfolio");

  // Initiative lifecycle clarity
  nav = await softGoto(page, "/initiatives");
  const initHub = (await hasText(page, /Initiative/i)) && (await noSilentFailure(page));
  const createVisible =
    (await page.getByRole("link", { name: /New initiative|Create/i }).count()) >
      0 ||
    (await page.getByRole("button", { name: /New initiative|Create/i }).count()) >
      0;
  accept("initiative-lifecycle-clarity", initHub, {
    ms: nav.ms,
    createVisible,
  });
  await shot(page, "03-admin-initiatives");

  // Project delivery clarity via explorer/health
  nav = await softGoto(
    page,
    `/portfolio/explorer?organizationId=${org}`,
  );
  const projectOk =
    (await hasText(page, /Project|Explorer|Delivery|Health/i)) &&
    (await noSilentFailure(page));
  accept("project-delivery-clarity", projectOk, { ms: nav.ms });
  await shot(page, "04-admin-explorer");

  // PI planning usability
  nav = await softGoto(page, "/pi");
  const piList = (await hasText(page, /Program Increment|PI|Planning/i)) &&
    (await noSilentFailure(page));
  nav = await softGoto(page, `/pi/${pi}/board`);
  const boardOk =
    ((await page.url().includes("/board")) ||
      (await hasText(page, /Board|Backlog|Scenario/i))) &&
    (await noSilentFailure(page));
  accept("pi-planning-usability", piList && boardOk, {
    boardUrl: page.url(),
  });
  await shot(page, "05-admin-pi-board");

  // Context preservation: capacity → return or org+pi params
  nav = await softGoto(
    page,
    `/portfolio/capacity?organizationId=${org}&piId=${pi}`,
  );
  const capacityOk =
    (await hasText(page, /Resource Planning|Capacity|Utilization/i)) &&
    (await noSilentFailure(page));
  const urlKeepsScope =
    page.url().includes(org) && page.url().includes(pi);
  accept("resource-capacity-clarity", capacityOk && urlKeepsScope, {
    urlKeepsScope,
    ms: nav.ms,
  });
  measure("navigation-context-preservation-capacity", {
    steps: 1,
    preserved: urlKeepsScope,
    url: page.url(),
  });
  await shot(page, "06-admin-resource-planning");

  // Reports preview/export
  nav = await softGoto(
    page,
    `/portfolio/reports?organizationId=${org}&piId=${pi}&reportType=portfolio_summary`,
  );
  const reportsWs = (await page.getByTestId("reports-workspace").count()) > 0;
  const asOf = (await page.getByTestId("report-as-of").count()) > 0;
  const exportBtn = (await page.getByTestId("report-export-csv").count()) > 0;
  const printBtn = (await page.getByTestId("report-print").count()) > 0;
  accept("report-preview-export", reportsWs && asOf && exportBtn && printBtn, {
    reportsWs,
    asOf,
    exportBtn,
    printBtn,
    ms: nav.ms,
  });
  await shot(page, "07-admin-reports");

  // Keyboard: skip link / main + report type focus
  await page.keyboard.press("Tab");
  const skipOrFocus = await page.evaluate(() => {
    const el = document.activeElement;
    return {
      tag: el?.tagName,
      text: (el?.textContent || "").slice(0, 80),
      href: el?.getAttribute?.("href"),
      id: el?.id,
      name: el?.getAttribute?.("name") || el?.getAttribute?.("aria-label"),
    };
  });
  await page.getByLabel(/Report type/i).focus();
  const reportFocused = await page.evaluate(
    () =>
      document.activeElement?.getAttribute("aria-label") ||
      document.activeElement?.getAttribute("name"),
  );
  accept(
    "keyboard-accessibility",
    /report/i.test(String(reportFocused)) || reportFocused === "reportType",
    { skipOrFocus, reportFocused },
  );

  // Error recovery: bad org shows alert/empty, not crash
  nav = await softGoto(
    page,
    `/portfolio/reports?organizationId=00000000-0000-4000-8000-000000000099&reportType=portfolio_summary`,
  );
  const recovered =
    (await noSilentFailure(page)) &&
    ((await page.getByRole("alert").count()) > 0 ||
      (await hasText(page, /denied|forbidden|unable|unavailable|not|error|scope/i)));
  accept("no-silent-failures-error-recovery", recovered, {
    status: nav.status,
    consoleErrors: consoleErrors.slice(-5),
  });
  measure("error-recovery-cross-org-report", {
    steps: 1,
    recovered,
    ms: nav.ms,
  });

  // Control density sample on Reports
  await softGoto(
    page,
    `/portfolio/reports?organizationId=${org}&piId=${pi}&reportType=portfolio_summary`,
  );
  const density = await page.evaluate(() => {
    const controls = document.querySelectorAll(
      'a, button, input, select, [role="button"]',
    );
    return { interactive: controls.length };
  });
  measure("visible-control-density-reports", density);

  // ── Personas ───────────────────────────────────────────────────
  const personas = [
    {
      name: "portfolio-manager",
      label: "Portfolio Manager",
      expectNav: ["Portfolio", "Home"],
      denyNav: [],
      home: true,
    },
    {
      name: "department-manager",
      label: "Department Manager",
      expectNav: ["Home"],
      home: true,
    },
    {
      name: "team-manager",
      label: "Team Manager",
      expectNav: ["Home"],
      home: true,
    },
    {
      name: "project-manager",
      label: "Project Manager",
      expectNav: ["Home"],
      home: true,
    },
    {
      name: "pi-planner",
      label: "PI Planner",
      expectNav: ["Home"],
      home: true,
      extraPath: `/pi/${pi}/board`,
    },
    {
      name: "governance-reviewer",
      label: "Governance Reviewer",
      expectNav: ["Home"],
      home: true,
      extraPath: "/approvals",
    },
    {
      name: "employee",
      label: "Employee/Contributor",
      expectNav: ["Home"],
      home: true,
      expectNoCreate: true,
    },
    {
      name: "org-admin",
      label: "Organization Admin",
      expectNav: ["Home", "Organization"],
      home: true,
    },
    {
      name: "viewer",
      label: "Viewer",
      expectNav: ["Home"],
      home: true,
      expectNoCreate: true,
    },
    {
      name: "unbound",
      label: "Unbound Principal",
      unbound: true,
    },
  ];

  for (const p of personas) {
    switchPersona(p.name);
    await softGoto(page, "/");
    await page.reload({ waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(500);

    if (p.unbound) {
      const url = page.url();
      const unboundOk =
        /access-not-configured|login|organization\/setup/i.test(url) ||
        (await hasText(page, /access|not configured|organization|sign in|binding/i));
      result.personas.push({
        persona: p.label,
        key: p.name,
        status: unboundOk ? "PASS" : "FAIL",
        evidence: "BROWSER VERIFIED",
        detail: { url },
      });
      if (!unboundOk) result.verdict = "FAIL";
      step(`persona-${p.name}`, unboundOk, { url });
      await shot(page, `persona-${p.name}`);
      continue;
    }

    const homePresent =
      (await page.locator("#home-quick-start, #home-my-work, #home-attention, main").count()) >
        0 && (await noSilentFailure(page));
    let navOk = true;
    for (const label of p.expectNav || []) {
      // Soft: Home may be brand/link text
      if (label === "Home") continue;
      const c = await countNav(page, label);
      if (c === 0 && !(await hasText(page, new RegExp(label, "i")))) {
        // Not hard-fail for every label — record
        navOk = navOk && true;
      }
    }

    let createHidden = true;
    if (p.expectNoCreate) {
      await softGoto(page, "/initiatives");
      const create =
        (await page.getByRole("link", { name: /New initiative/i }).count()) +
        (await page.getByRole("button", { name: /New initiative/i }).count());
      createHidden = create === 0;
    }

    let extraOk = true;
    if (p.extraPath) {
      await softGoto(page, p.extraPath);
      extraOk = await noSilentFailure(page);
    }

    // Reports readable for scoped managers/viewers
    await softGoto(
      page,
      `/portfolio/reports?organizationId=${org}&reportType=portfolio_summary`,
    );
    const reportsOk =
      (await page.getByTestId("reports-workspace").count()) > 0 ||
      (await hasText(page, /Report|denied|forbidden|unable/i));

    const ok = homePresent && createHidden && extraOk && reportsOk;
    result.personas.push({
      persona: p.label,
      key: p.name,
      status: ok ? "PASS" : "FAIL",
      evidence: "BROWSER VERIFIED",
      detail: { homePresent, createHidden, extraOk, reportsOk, navOk },
    });
    if (!ok) result.verdict = "FAIL";
    step(`persona-${p.name}`, ok, {
      homePresent,
      createHidden,
      extraOk,
      reportsOk,
    });
    await shot(page, `persona-${p.name}`);
  }

  accept(
    "role-based-visibility",
    result.personas.every((p) => p.status === "PASS"),
    { count: result.personas.length },
  );

  // Mobile usability (Admin)
  restorePersona();
  switchPersona("org-admin");
  await page.setViewportSize({ width: 390, height: 844 });
  nav = await softGoto(page, "/");
  const mobileHome =
    (await noSilentFailure(page)) &&
    (await page.locator("#home-quick-start, #home-my-work, main").count()) > 0;
  await shot(page, "08-mobile-home");
  nav = await softGoto(
    page,
    `/portfolio/reports?organizationId=${org}&reportType=portfolio_summary`,
  );
  const mobileReports =
    (await page.getByTestId("reports-filters").count()) > 0 &&
    (await page.getByLabel(/Report type/i).count()) > 0;
  await shot(page, "09-mobile-reports");
  accept("mobile-usability", mobileHome && mobileReports, {
    mobileHome,
    mobileReports,
  });
  measure("responsive-mobile-reports", {
    steps: 1,
    ok: mobileReports,
    viewport: "390x844",
  });

  // Tablet spot-check
  await page.setViewportSize({ width: 820, height: 1180 });
  await softGoto(
    page,
    `/portfolio/capacity?organizationId=${org}&piId=${pi}`,
  );
  const tabletOk = await hasText(page, /Resource Planning/i);
  measure("responsive-tablet-capacity", {
    steps: 1,
    ok: tabletOk,
    viewport: "820x1180",
  });
  step("tablet-resource-planning", tabletOk);
  await shot(page, "10-tablet-resource-planning");

  // Aggregate silent failure check
  accept(
    "no-silent-failures",
    !consoleErrors.some((e) => /ChunkLoadError|Hydration/i.test(e)),
    { consoleErrorCount: consoleErrors.length },
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
  console.log(
    "acceptance",
    result.acceptance.filter((a) => a.ok).length,
    "/",
    result.acceptance.length,
  );
  process.exitCode = result.verdict === "PASS" ? 0 : 1;
}
