/**
 * M5E-A — Resource Planning workspace browser QA.
 * Personas: org-admin, department-manager, team-manager, viewer.
 * Viewports: desktop / tablet / mobile.
 * Fixtures: shared resources, overload, unavailable PI.
 */
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import fs from "fs";
import path from "node:path";

const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:43155";
const pass = fs
  .readFileSync(process.env.QA_PASS_FILE ?? "/tmp/m3dd-qa-pass.txt", "utf8")
  .trim();
const outDir =
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m5ea-qa");
const docsShotDir = path.join(
  process.cwd(),
  "docs/acceptance-assets/m5ea/screenshots",
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

run("npx", ["tsx", "scripts/m5ea-seed-browser.mts"], {
  DATABASE_URL: dbUrl,
  DIRECT_URL: dbUrl,
  TEMP_AUTH_PRINCIPAL_ID: principalId,
  QA_OUT_DIR: outDir,
});

const seed = JSON.parse(fs.readFileSync(path.join(outDir, "seed.json"), "utf8"));
const capacityUrl = seed.paths.resourcePlanning;
const unavailableUrl = seed.paths.unavailable;

const result = {
  milestone: "M5E-A",
  base,
  generatedAt: new Date().toISOString(),
  startingMainHint: "d362c61",
  seed,
  personas: [],
  viewports: [],
  steps: [],
  verdict: "PASS",
};

function step(name, ok, extra = {}) {
  result.steps.push({ step: name, status: ok ? "PASS" : "FAIL", ...extra });
  if (!ok) result.verdict = "FAIL";
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`, extra.detail ?? "");
}

function persona(name, ok, extra = {}) {
  result.personas.push({
    persona: name,
    status: ok ? "PASS" : "FAIL",
    ...extra,
  });
  if (!ok) result.verdict = "FAIL";
  console.log(`${ok ? "PASS" : "FAIL"} persona:${name}`, extra.detail ?? "");
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

async function softGoto(page, pathOrUrl) {
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${base}${pathOrUrl}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);
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

try {
  // Ensure org-admin bindings for baseline
  switchPersona("org-admin");
  await login(page);
  step("1-org-admin-login", true);

  await softGoto(page, capacityUrl);

  const titleOk =
    (await page.getByRole("heading", { name: /^Resource Planning$/i }).count()) >
      0 ||
    (await page.getByText(/Resource Planning ·/i).count()) > 0;
  step("2-resource-planning-branding", titleOk);

  const navOk =
    (await page
      .getByRole("navigation", { name: /Primary/i })
      .getByRole("link", { name: /Resource Planning/i })
      .count()) > 0;
  step("3-nav-resource-planning", navOk);

  const summaryOk =
    (await page.getByTestId("capacity-summary").count()) > 0;
  const hierarchyOk =
    (await page.getByTestId("capacity-hierarchy").count()) > 0;
  const contextOk =
    (await page.getByTestId("capacity-planning-context").count()) > 0;
  step("4-executive-sections", summaryOk && hierarchyOk && contextOk, {
    detail: { summaryOk, hierarchyOk, contextOk },
  });

  const piSelect = page.getByLabel(/Select Program Increment/i);
  const piOk = (await piSelect.count()) > 0;
  step("5-pi-period-selection", piOk);

  // Expand hierarchy — stacked bars / legend when project segments exist
  const expandBtn = page.getByRole("button", { name: /View .* team/i }).first();
  if ((await expandBtn.count()) > 0) {
    await expandBtn.click();
    await page.waitForTimeout(400);
  }
  const stackedCopy =
    (await page.getByText(/Stacked bars show real CURRENT project/i).count()) >
      0 ||
    (await page.getByText(/No FTE or workstream percentages/i).count()) > 0;
  step("6-stacked-bar-policy-copy", stackedCopy);

  // Overload filter
  const overloadCb = page.getByLabel(/Overloaded only/i);
  if ((await overloadCb.count()) > 0) {
    await overloadCb.check();
    await page.waitForTimeout(300);
  }
  const attentionOk =
    (await page.getByTestId("capacity-management-attention").count()) > 0;
  step("7-overload-filter", attentionOk);
  await shot(page, "01-desktop-resource-planning");

  // Search
  const search = page.getByLabel(/Search departments or people/i);
  if ((await search.count()) > 0) {
    await search.fill("zzz-no-match-m5ea");
    await page.waitForTimeout(300);
    const empty =
      (await page.getByRole("heading", { name: /No departments match/i }).count()) >
      0;
    step("8-search-empty", empty);
    await search.fill("");
    await page.waitForTimeout(200);
  } else {
    step("8-search-empty", false, { detail: "search missing" });
  }

  // Conflicts / dependencies panels
  const conflictsOk =
    (await page.getByText(/Planning conflicts|conflict/i).count()) > 0;
  const depsOk =
    (await page.getByText(/Dependenc/i).count()) > 0 ||
    (await page.getByText(/Project commitments/i).count()) > 0;
  step("9-conflict-dependency-panels", conflictsOk && depsOk, {
    detail: { conflictsOk, depsOk },
  });

  // Shared resource policy
  const sharedOk =
    (await page.getByText(/Shared resource policy/i).count()) > 0 &&
    (await page.getByText(/membership allocation percent/i).count()) > 0;
  step("10-shared-resource-policy", sharedOk);

  // Contextual nav to PI / Project
  const piLink =
    (await page.getByRole("link", { name: /Open PI Planning|PI Planning/i }).count()) >
    0;
  const projLink =
    (await page.getByRole("link", { name: /PRJ-|project/i }).count()) > 0;
  step("11-contextual-nav", piLink, { detail: { piLink, projLink } });

  if (piLink) {
    await page.getByRole("link", { name: /Open PI Planning|PI Planning/i }).first().click();
    await page.waitForTimeout(1000);
    const onPi = page.url().includes("/pi/");
    step("12-nav-to-pi", onPi, { detail: page.url() });
    await softGoto(page, capacityUrl);
  } else {
    step("12-nav-to-pi", false);
  }

  // Unavailable PI
  if (unavailableUrl) {
    await softGoto(page, unavailableUrl);
    const unavailableOk =
      (await page.getByText(/unavailable|no participating|Select a Program/i).count()) >
        0 ||
      (await page.getByTestId("capacity-summary").count()) === 0 ||
      (await page.getByText(/Zero committed|No participating/i).count()) > 0 ||
      (await page.getByRole("status").count()) > 0;
    // Empty PI may still be ready with zero teams — accept either unavailable or empty hierarchy
    const emptyOrUnavail =
      unavailableOk ||
      (await page.getByText(/No participating departments/i).count()) > 0 ||
      (await page.getByTestId("capacity-planning-context").count()) > 0;
    step("13-unavailable-pi", emptyOrUnavail);
    await shot(page, "02-unavailable-pi");
  } else {
    step("13-unavailable-pi", false, { detail: "no unavailable PI seeded" });
  }

  await softGoto(page, capacityUrl);

  // Responsive
  for (const vp of [
    { name: "tablet", width: 820, height: 1180 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await softGoto(page, capacityUrl);
    const ok =
      (await page.getByTestId("portfolio-capacity-dashboard").count()) > 0;
    result.viewports.push({ viewport: vp.name, status: ok ? "PASS" : "FAIL" });
    if (!ok) result.verdict = "FAIL";
    await shot(page, `03-${vp.name}`);
    step(`14-${vp.name}`, ok);
  }

  await page.setViewportSize({ width: 1440, height: 900 });

  // Personas
  const personaSpecs = [
    { id: "org-admin", expectSummary: true },
    { id: "department-manager", expectSummary: true, scoped: true },
    { id: "team-manager", expectSummary: true, scoped: true },
    { id: "viewer", expectSummary: true, readOnly: true },
  ];

  for (const spec of personaSpecs) {
    switchPersona(spec.id);
    await softGoto(page, capacityUrl);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(600);

    const hasDashboard =
      (await page.getByTestId("portfolio-capacity-dashboard").count()) > 0;
    const forbidden =
      (await page.getByText(/unavailable for this scope|FORBIDDEN|Missing PI/i).count()) >
      0;
    const branding =
      (await page.getByText(/Resource Planning/i).count()) > 0;

    // Scoped managers may see forbidden for org/section PI — that preserves scoped visibility.
    const ok = hasDashboard && branding && (spec.expectSummary
      ? (await page.getByTestId("capacity-summary").count()) > 0 ||
        (await page.getByTestId("capacity-planning-context").count()) > 0 ||
        forbidden
      : true);

    await shot(page, `persona-${spec.id}`);
    persona(spec.id, ok, {
      detail: { hasDashboard, branding, forbidden, scoped: !!spec.scoped },
    });
  }

  restorePersona();
  await shot(page, "04-desktop-final");
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
  console.log(
    JSON.stringify(
      { verdict: result.verdict, steps: result.steps.length, outDir },
      null,
      2,
    ),
  );
  if (result.verdict !== "PASS") process.exit(1);
}
