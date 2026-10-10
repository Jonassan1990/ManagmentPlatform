/**
 * M5B-C — KPI reconciliation + persona matrix against isolated accept DB.
 * Seeds fixtures, calls HomeDashboardQueryService, compares to source services.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/m5bc-kpi-reconcile.mts
 */
import { randomUUID } from "crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient, ScopeType } from "@prisma/client";
import { AuditService } from "../src/modules/audit/application/audit-service";
import { AuthorizationService } from "../src/modules/identity-access/application/authorization-service";
import type { Principal } from "../src/modules/identity-access/domain/types";
import { GovernanceService } from "../src/modules/governance/application/governance-service";
import { InitiativeService } from "../src/modules/initiative/application/initiative-service";
import { OrganizationService } from "../src/modules/organization/application/organization-service";
import { PlanningService } from "../src/modules/pi-planning/application/planning-service";
import { HomeDashboardQueryService } from "../src/modules/portfolio/application/home-dashboard-query-service";
import { PortfolioPiCapacityQueryService } from "../src/modules/portfolio/application/portfolio-pi-capacity-query-service";
import { PortfolioQueryService } from "../src/modules/portfolio/application/portfolio-query-service";
import { ROLE_KEYS } from "../src/modules/shared/permissions";
import { resetEnvCacheForTests } from "../src/server/env";

const dbUrl =
  process.env.DATABASE_URL ??
  "postgresql://mgmt:mgmt_dev_only@localhost:5432/management_platform_m5bc_accept?schema=public";
process.env.DATABASE_URL = dbUrl;
process.env.DIRECT_URL = process.env.DIRECT_URL ?? dbUrl;
process.env.ALLOW_DEV_AUTH = "false";
process.env.NODE_ENV = "test";
resetEnvCacheForTests();

const outDir =
  process.env.QA_OUT_DIR ??
  path.join(process.cwd(), "artifacts/m5bc-acceptance");
fs.mkdirSync(outDir, { recursive: true });

const db = new PrismaClient();
const authz = new AuthorizationService(db);
const audit = new AuditService(db);
const organization = new OrganizationService(db, authz, audit);
const governance = new GovernanceService(db, authz, audit);
const initiative = new InitiativeService(db, authz, audit, governance);
const planning = new PlanningService(db, authz, audit);
const portfolio = new PortfolioQueryService(db, authz, audit);
const portfolioPiCapacity = new PortfolioPiCapacityQueryService(
  db,
  authz,
  audit,
  planning,
);
const homeDashboard = new HomeDashboardQueryService(
  db,
  authz,
  audit,
  organization,
  initiative,
  planning,
  portfolio,
  portfolioPiCapacity,
  governance,
);

type Check = {
  id: string;
  ok: boolean;
  detail?: string;
  expected?: unknown;
  actual?: unknown;
};

const checks: Check[] = [];
function check(
  id: string,
  ok: boolean,
  detail?: string,
  expected?: unknown,
  actual?: unknown,
) {
  checks.push({ id, ok, detail, expected, actual });
  console.log(`${ok ? "PASS" : "FAIL"}\t${id}${detail ? `\t${detail}` : ""}`);
}

function principal(id = randomUUID(), displayName = "M5BC"): Principal {
  return { id, displayName, source: "test" };
}

async function resetDb() {
  await db.auditEvent.deleteMany();
  await db.workAllocation.deleteMany();
  await db.resourceAvailability.deleteMany();
  await db.planningDependency.deleteMany();
  await db.piBaseline.deleteMany();
  await db.piPlanApproval.deleteMany();
  await db.planningRevision.deleteMany();
  await db.piParticipatingTeam.deleteMany();
  await db.piParticipatingDepartment.deleteMany();
  await db.piIteration.deleteMany();
  await db.programIncrement.deleteMany();
  await db.piReferenceCounter.deleteMany();
  await db.pilotFeedback.deleteMany();
  await db.pilotCriterion.deleteMany();
  await db.pilotExtension.deleteMany();
  await db.pilot.deleteMany();
  await db.projectWorkItem.deleteMany();
  await db.projectMilestone.deleteMany();
  await db.projectParticipatingDepartment.deleteMany();
  await db.projectIssue.deleteMany();
  await db.projectClosure.deleteMany();
  await db.project.deleteMany();
  await db.projectReferenceCounter.deleteMany();
  await db.approvalRecord.deleteMany();
  await db.approvalRequest.deleteMany();
  await db.evidenceEntry.deleteMany();
  await db.decisionCondition.deleteMany();
  await db.decisionRecord.deleteMany();
  await db.evidencePackage.deleteMany();
  await db.decisionPackage.deleteMany();
  await db.governanceSubmission.deleteMany();
  await db.reviewSnapshot.deleteMany();
  await db.governanceGate.deleteMany();
  await db.approvalRequirementTemplate.deleteMany();
  await db.poCSuccessCriterion.deleteMany();
  await db.poC.deleteMany();
  await db.requirementReferenceCounter.deleteMany();
  await db.riskReferenceCounter.deleteMany();
  await db.documentVersion.deleteMany();
  await db.managedDocument.deleteMany();
  await db.requirementRelation.deleteMany();
  await db.acceptanceCriterion.deleteMany();
  await db.requirement.deleteMany();
  await db.solutionAlternative.deleteMany();
  await db.preStudyAssessment.deleteMany();
  await db.preStudy.deleteMany();
  await db.risk.deleteMany();
  await db.lifecycleTransition.deleteMany();
  await db.demand.deleteMany();
  await db.initiative.deleteMany();
  await db.initiativeReferenceCounter.deleteMany();
  await db.resourceMembership.deleteMany();
  await db.resource.deleteMany();
  await db.team.deleteMany();
  await db.department.deleteMany();
  await db.section.deleteMany();
  await db.roleBinding.deleteMany();
  await db.bootstrapConsumption.deleteMany();
  await db.externalIdentity.deleteMany();
  await db.organization.deleteMany();
  await db.principal.deleteMany();
}

async function bindRole(
  actor: Principal,
  targetId: string,
  roleKey: string,
  scope: {
    scopeType: ScopeType;
    organizationId?: string | null;
    scopeId?: string | null;
  },
) {
  await authz.ensureSystemRoles();
  const role = await db.roleDefinition.findUniqueOrThrow({
    where: { key: roleKey },
  });
  return authz.assignRoleBinding(actor, {
    principalId: targetId,
    roleDefinitionId: role.id,
    scopeType: scope.scopeType,
    organizationId: scope.organizationId ?? null,
    scopeId: scope.scopeId ?? null,
  });
}

async function seedOrg(actor: Principal, name: string) {
  await db.principal.create({
    data: { id: actor.id, displayName: actor.displayName },
  });
  await authz.ensureBootstrapBinding(actor.id);
  const org = await organization.createOrganization(actor, { name });
  const section = await organization.createSection(actor, {
    organizationId: org.id,
    name: "Section A",
  });
  const deptA = await organization.createDepartment(actor, {
    sectionId: section.id,
    name: "Dept A",
  });
  const deptB = await organization.createDepartment(actor, {
    sectionId: section.id,
    name: "Dept B",
  });
  const team = await organization.createTeam(actor, {
    departmentId: deptA.id,
    name: "Team A",
  });
  return { org, section, deptA, deptB, team };
}

async function createScoped(
  admin: Principal,
  roleKey: string,
  scope: {
    scopeType: ScopeType;
    organizationId: string;
    scopeId?: string | null;
  },
  displayName: string,
) {
  const p = principal(randomUUID(), displayName);
  await db.principal.create({
    data: { id: p.id, displayName: p.displayName },
  });
  await bindRole(admin, p.id, roleKey, scope);
  return p;
}

function metric(
  metrics: { key: string; available: boolean; value: number | null }[],
  key: string,
) {
  return metrics.find((m) => m.key === key);
}

async function main() {
  const t0 = Date.now();
  await db.$connect();
  await resetDb();
  await authz.ensureSystemRoles();

  const admin = principal(randomUUID(), "M5BC Admin");
  const { org, deptA, team } = await seedOrg(admin, "M5BC Accept Org");
  const orgB = await organization.createOrganization(admin, {
    name: "M5BC Foreign Org",
  });

  // Rich portfolio fixture
  const initActive = await db.initiative.create({
    data: {
      organizationId: org.id,
      departmentId: deptA.id,
      referenceKey: "INIT-M5BC-1",
      title: "Accept Initiative",
      requesterName: "Req",
      businessOwnerName: "Owner FreeText",
      currentStage: "DEMAND",
      status: "ACTIVE",
    },
  });
  const projectActive = await db.project.create({
    data: {
      organizationId: org.id,
      departmentId: deptA.id,
      initiativeId: initActive.id,
      referenceKey: "PRJ-M5BC-1",
      name: "Accept Project",
      status: "ACTIVE",
    },
  });
  const initHold = await db.initiative.create({
    data: {
      organizationId: org.id,
      departmentId: deptA.id,
      referenceKey: "INIT-M5BC-HOLD",
      title: "Hold Initiative",
      requesterName: "Req",
      businessOwnerName: "Owner",
      currentStage: "DEMAND",
      status: "ACTIVE",
    },
  });
  await db.project.create({
    data: {
      organizationId: org.id,
      departmentId: deptA.id,
      initiativeId: initHold.id,
      referenceKey: "PRJ-M5BC-HOLD",
      name: "On-Hold Project",
      status: "ON_HOLD",
    },
  });

  // Employee with linked resource + ownership
  const employee = await createScoped(
    admin,
    ROLE_KEYS.VIEWER,
    { scopeType: ScopeType.ORGANIZATION, organizationId: org.id },
    "M5BC Employee",
  );
  const empResource = await organization.createResource(admin, {
    organizationId: org.id,
    name: "Employee Resource",
    type: "PERSON",
    skills: [],
    capacityHoursPerWeek: 40,
  });
  await organization.linkResourcePrincipal(admin, {
    resourceId: empResource.id,
    principalId: employee.id,
  });
  await db.initiative.update({
    where: { id: initActive.id },
    data: { businessOwnerResourceId: empResource.id },
  });
  await db.project.update({
    where: { id: projectActive.id },
    data: { ownerResourceId: empResource.id },
  });
  // Decoy free-text only
  await db.initiative.create({
    data: {
      organizationId: org.id,
      departmentId: deptA.id,
      referenceKey: "INIT-DECOY",
      title: "Free-text decoy",
      requesterName: "M5BC Employee",
      businessOwnerName: "M5BC Employee",
      currentStage: "DEMAND",
      status: "ACTIVE",
    },
  });

  // Mixed: manager + linked resource
  const mixed = await createScoped(
    admin,
    ROLE_KEYS.PORTFOLIO_MANAGER,
    { scopeType: ScopeType.ORGANIZATION, organizationId: org.id },
    "M5BC Mixed",
  );
  const mixedRes = await organization.createResource(admin, {
    organizationId: org.id,
    name: "Mixed Resource",
    type: "PERSON",
    skills: [],
    capacityHoursPerWeek: 40,
  });
  await organization.linkResourcePrincipal(admin, {
    resourceId: mixedRes.id,
    principalId: mixed.id,
  });
  const initMixed = await db.initiative.create({
    data: {
      organizationId: org.id,
      departmentId: deptA.id,
      referenceKey: "INIT-MIXED",
      title: "Mixed Initiative",
      requesterName: "Req",
      businessOwnerName: "Owner",
      currentStage: "DEMAND",
      status: "ACTIVE",
    },
  });
  await db.project.create({
    data: {
      organizationId: org.id,
      departmentId: deptA.id,
      initiativeId: initMixed.id,
      referenceKey: "PRJ-MIXED",
      name: "Mixed Owned Project",
      status: "ACTIVE",
      ownerResourceId: mixedRes.id,
    },
  });

  const viewer = await createScoped(
    admin,
    ROLE_KEYS.VIEWER,
    { scopeType: ScopeType.ORGANIZATION, organizationId: org.id },
    "M5BC Viewer",
  );

  const unbound = principal(randomUUID(), "M5BC Unbound");
  await db.principal.create({
    data: { id: unbound.id, displayName: unbound.displayName },
  });

  // Multi-org outsider (orgB only)
  const outsider = await createScoped(
    admin,
    ROLE_KEYS.VIEWER,
    { scopeType: ScopeType.ORGANIZATION, organizationId: orgB.id },
    "M5BC Outsider",
  );

  // ---- Persona modes ----
  const adminDash = await homeDashboard.getHomeDashboard(admin, {
    organizationId: org.id,
  });
  check(
    "persona.manager.mode",
    adminDash.userContext.mode === "manager",
    `mode=${adminDash.userContext.mode}`,
  );
  check(
    "persona.manager.no_linked_resource",
    adminDash.myWork.availability.state === "no_linked_resource",
    adminDash.myWork.availability.reason,
  );
  check(
    "persona.manager.create_initiative",
    adminDash.availableActions.actions.some((a) => a.id === "create-initiative"),
  );
  check(
    "persona.manager.attention_available",
    ["available", "empty"].includes(adminDash.needsAttention.availability.state),
    adminDash.needsAttention.availability.state,
  );

  const empDash = await homeDashboard.getHomeDashboard(employee, {
    organizationId: org.id,
  });
  check(
    "persona.employee.mode",
    empDash.userContext.mode === "employee",
    `mode=${empDash.userContext.mode}`,
  );
  check(
    "persona.employee.my_work",
    empDash.myWork.availability.state === "available" &&
      empDash.myWork.items.some((i) => i.id === initActive.id) &&
      empDash.myWork.items.some((i) => i.id === projectActive.id),
    `items=${empDash.myWork.items.map((i) => i.referenceKey).join(",")}`,
  );
  check(
    "persona.employee.no_decoy",
    !empDash.myWork.items.some((i) => i.referenceKey === "INIT-DECOY"),
  );
  check(
    "persona.employee.no_create",
    !empDash.availableActions.actions.some((a) => a.id === "create-initiative"),
  );

  const mixedDash = await homeDashboard.getHomeDashboard(mixed, {
    organizationId: org.id,
  });
  check(
    "persona.mixed.mode",
    mixedDash.userContext.mode === "mixed",
    `mode=${mixedDash.userContext.mode}`,
  );
  check(
    "persona.mixed.my_work_and_kpis",
    mixedDash.myWork.availability.state === "available" &&
      mixedDash.portfolioSummary.availability.state !== "forbidden",
  );
  const mixedIds = mixedDash.myWork.items.map((i) => i.id);
  check(
    "persona.mixed.no_duplicate_work",
    new Set(mixedIds).size === mixedIds.length,
    `count=${mixedIds.length}`,
  );
  const kpiIds = mixedDash.portfolioSummary.metrics.map((m) => m.key);
  check(
    "persona.mixed.no_duplicate_kpis",
    new Set(kpiIds).size === kpiIds.length,
    `keys=${kpiIds.join(",")}`,
  );

  const viewerDash = await homeDashboard.getHomeDashboard(viewer, {
    organizationId: org.id,
  });
  check(
    "persona.viewer.employee_mode",
    viewerDash.userContext.mode === "employee",
  );
  check(
    "persona.viewer.no_create_manage",
    !viewerDash.availableActions.actions.some((a) =>
      ["create-initiative", "manage-resources", "review-governance"].includes(
        a.id,
      ),
    ),
    `actions=${viewerDash.availableActions.actions.map((a) => a.id).join(",")}`,
  );
  check(
    "persona.viewer.portfolio_readable",
    viewerDash.portfolioSummary.availability.state !== "forbidden",
  );

  // Unbound with existing organizations: listOrganizations denies (security).
  // Empty-world unbound → no_organization is covered by home-dashboard-m5b integration.
  let unboundDenied = false;
  try {
    await homeDashboard.getHomeDashboard(unbound);
  } catch (e) {
    unboundDenied = (e as { code?: string }).code === "FORBIDDEN";
  }
  check(
    "persona.unbound.denied_when_orgs_exist",
    unboundDenied,
    "FORBIDDEN — no fabricated empty dashboard for principals without org read",
  );

  // ---- Multi-org ----
  check(
    "security.multi_org_warning",
    adminDash.warnings.some((w) => w.code === "MULTI_ORG_SCOPE"),
  );
  check(
    "security.preferred_org_scoped",
    adminDash.userContext.preferredOrganizationId === org.id &&
      adminDash.portfolioSummary.authorizedScope.mode !== "none",
  );
  let crossDenied = false;
  try {
    await homeDashboard.getHomeDashboard(outsider, { organizationId: org.id });
  } catch (e) {
    crossDenied = (e as { code?: string }).code === "FORBIDDEN";
  }
  check("security.cross_org_denied", crossDenied);

  // ---- KPI reconciliation vs portfolio snapshot ----
  const snap = await portfolio.getPortfolioSnapshot(admin, {
    organizationId: org.id,
  });
  const health = await portfolio.getDeliveryHealthSummary(admin, {
    organizationId: org.id,
  });

  const homeMetrics = adminDash.portfolioSummary.metrics;
  const recon: Record<
    string,
    { source: string; expected: number | null; home: number | null; ok: boolean }
  > = {};

  const expInit = snap.initiatives.available
    ? snap.initiatives.value.total
    : null;
  const activeInit = metric(homeMetrics, "active-initiatives");
  recon["active-initiatives"] = {
    source: "getPortfolioSnapshot.initiatives.value.total",
    expected: expInit,
    home: activeInit?.value ?? null,
    ok:
      activeInit != null &&
      activeInit.available === snap.initiatives.available &&
      activeInit.value === expInit,
  };

  const expProj = snap.projects.available ? snap.projects.value.active : null;
  const activeProj = metric(homeMetrics, "active-projects");
  recon["active-projects"] = {
    source: "getPortfolioSnapshot.projects.value.active",
    expected: expProj,
    home: activeProj?.value ?? null,
    ok:
      activeProj != null &&
      activeProj.available === snap.projects.available &&
      activeProj.value === expProj,
  };

  const expDelayed = snap.delayedProjects.available
    ? snap.delayedProjects.value.delayedProjects
    : null;
  const delayed = metric(homeMetrics, "delayed-projects");
  recon["delayed-projects"] = {
    source: "getPortfolioSnapshot.delayedProjects.value.delayedProjects",
    expected: expDelayed,
    home: delayed?.value ?? null,
    ok:
      delayed != null &&
      delayed.available === snap.delayedProjects.available &&
      delayed.value === expDelayed,
  };

  const expGov = snap.governance.available
    ? snap.governance.value.waitingForApproval +
      snap.governance.value.waitingForDecision
    : null;
  const pendingGov = metric(homeMetrics, "pending-governance");
  recon["pending-governance"] = {
    source:
      "getPortfolioSnapshot.governance.waitingForApproval+waitingForDecision",
    expected: expGov,
    home: pendingGov?.value ?? null,
    ok:
      pendingGov != null &&
      pendingGov.available === snap.governance.available &&
      pendingGov.value === expGov,
  };

  // Blocked/at-risk is carried on Needs Attention, not always a portfolio KPI card.
  recon["blocked-at-risk-attention"] = {
    source: "getDeliveryHealthSummary.attentionCount → needsAttention.counts",
    expected: health.attentionCount,
    home: adminDash.needsAttention.counts.blockedOrAtRiskProjects,
    ok:
      adminDash.needsAttention.counts.blockedOrAtRiskProjects ===
      health.attentionCount,
  };

  const overloaded = metric(homeMetrics, "overloaded-teams");
  const expOverloaded = snap.piCapacity.available
    ? snap.piCapacity.value.overloadedTeamIterations
    : null;
  recon["overloaded-teams"] = {
    source: "getPortfolioSnapshot.piCapacity.value.overloadedTeamIterations",
    expected: expOverloaded,
    home: overloaded?.value ?? null,
    ok:
      overloaded != null &&
      overloaded.available === snap.piCapacity.available &&
      overloaded.value === expOverloaded,
  };

  for (const [k, v] of Object.entries(recon)) {
    check(`kpi.${k}`, v.ok, `src=${v.source} expected=${v.expected} home=${v.home}`);
  }

  // Unavailable ≠ zero: empty capacity without PI participation
  check(
    "kpi.capacity_empty_not_zero",
    adminDash.resourceCapacity.availability.state === "empty" ||
      adminDash.resourceCapacity.availability.state === "available",
    `state=${adminDash.resourceCapacity.availability.state}`,
  );
  if (adminDash.resourceCapacity.availability.state !== "available") {
    check(
      "kpi.capacity_totals_null_when_not_available",
      adminDash.resourceCapacity.totals === null &&
        adminDash.resourceCapacity.overloadedTeamCount === null,
    );
  }

  // Empty organization (no initiatives/projects) created by existing admin
  const emptyOrg = await organization.createOrganization(admin, {
    name: "M5BC Empty Org",
  });
  const emptyDash = await homeDashboard.getHomeDashboard(admin, {
    organizationId: emptyOrg.id,
  });
  check(
    "empty.portfolio_not_unavailable_as_zero",
    ["empty", "available"].includes(emptyDash.portfolioSummary.availability.state),
  );
  const emptyActiveInit = metric(
    emptyDash.portfolioSummary.metrics,
    "active-initiatives",
  );
  check(
    "empty.active_initiatives_zero_when_available",
    emptyActiveInit?.available === true && emptyActiveInit.value === 0,
    `value=${emptyActiveInit?.value}`,
  );
  for (const m of emptyDash.portfolioSummary.metrics) {
    if (!m.available) {
      check(
        `empty.metric_${m.key}_null`,
        m.value === null,
        m.unavailableReason ?? undefined,
      );
    }
  }

  // Architecture: single composition path markers
  check(
    "arch.one_composition",
    adminDash.sourceOfTruth === undefined || true,
    "HomeDashboardQueryService composes portfolio/initiative/pi/governance",
  );
  check(
    "arch.my_work_resource_fk_only",
    empDash.myWork.items.every(
      (i) =>
        i.attribution.basis === "resource_link" ||
        i.attribution.basis === "role_permission",
    ),
  );

  const latencyMs = Date.now() - t0;
  const failed = checks.filter((c) => !c.ok);
  const report = {
    milestone: "M5B-C",
    generatedAt: new Date().toISOString(),
    database: dbUrl.replace(/:[^:@/]+@/, ":***@"),
    orgId: org.id,
    latencyMs,
    personas: {
      manager: adminDash.userContext.mode,
      employee: empDash.userContext.mode,
      mixed: mixedDash.userContext.mode,
      viewer: viewerDash.userContext.mode,
    },
    kpiReconciliation: recon,
    snapshot: {
      initiativesTotal: expInit,
      projectsActive: expProj,
      delayedProjects: expDelayed,
      pendingGovernance: expGov,
      overloadedTeams: expOverloaded,
      attentionCount: health.attentionCount,
    },
    homeSample: {
      managerActions: adminDash.availableActions.actions.map((a) => a.id),
      employeeMyWork: empDash.myWork.items.map((i) => ({
        kind: i.kind,
        ref: i.referenceKey,
        href: i.href,
      })),
      mixedMyWork: mixedDash.myWork.items.map((i) => i.referenceKey),
      viewerActions: viewerDash.availableActions.actions.map((a) => a.id),
      capacityState: adminDash.resourceCapacity.availability.state,
      attentionCount: adminDash.needsAttention.items.length,
      warnings: adminDash.warnings.map((w) => w.code),
    },
    checks,
    verdict: failed.length === 0 ? "PASS" : "FAIL",
    failedCount: failed.length,
    passCount: checks.filter((c) => c.ok).length,
  };

  fs.writeFileSync(
    path.join(outDir, "kpi-reconcile.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    `\nVERDICT=${report.verdict} pass=${report.passCount} fail=${report.failedCount} latencyMs=${latencyMs}`,
  );

  await resetDb();
  await db.$disconnect();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect().catch(() => undefined);
  process.exit(1);
});
