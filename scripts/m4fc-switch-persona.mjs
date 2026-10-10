/**
 * M4F-C — Swap RoleBindings on the temp-auth principal for browser persona QA.
 * Does NOT change AuthorizationService. Restores prior bindings on --restore.
 *
 * Usage:
 *   DATABASE_URL=... TEMP_AUTH_PRINCIPAL_ID=... node scripts/m4fc-switch-persona.mjs --persona=viewer
 *   DATABASE_URL=... TEMP_AUTH_PRINCIPAL_ID=... node scripts/m4fc-switch-persona.mjs --restore
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const principalId =
  process.env.TEMP_AUTH_PRINCIPAL_ID || process.env.QA_PRINCIPAL_ID;
if (!principalId) {
  throw new Error("TEMP_AUTH_PRINCIPAL_ID required");
}

const orgId =
  process.env.QA_ORG_ID ?? "f6b317a2-839d-413b-9aa1-2ea4e006f486";
const sectionId =
  process.env.QA_SECTION_ID ?? "ab6164ab-3fa2-4d87-adbb-afe36db6515a";
const departmentId =
  process.env.QA_DEPARTMENT_ID ?? "805efbca-cc27-4779-b85b-953daee3d10d";
const teamId =
  process.env.QA_TEAM_ID ?? "6117ef1b-6bf9-422e-8b4e-ebb5a22d9a72";

const statePath =
  process.env.QA_PERSONA_STATE ??
  path.join(process.cwd(), "artifacts/m4fc-qa/persona-state.json");

const args = process.argv.slice(2);
const restore = args.includes("--restore");
const personaArg = args.find((a) => a.startsWith("--persona="));
const persona = personaArg ? personaArg.split("=")[1] : null;

/** Soft-end active bindings for the principal and snapshot them. */
async function snapshotAndClear() {
  const active = await db.roleBinding.findMany({
    where: { principalId, effectiveTo: null },
  });
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  if (!fs.existsSync(statePath)) {
    fs.writeFileSync(
      statePath,
      JSON.stringify(
        {
          principalId,
          capturedAt: new Date().toISOString(),
          bindings: active.map((b) => ({
            id: b.id,
            roleDefinitionId: b.roleDefinitionId,
            scopeType: b.scopeType,
            organizationId: b.organizationId,
            scopeId: b.scopeId,
          })),
        },
        null,
        2,
      ),
    );
  }
  const now = new Date();
  for (const b of active) {
    await db.roleBinding.update({
      where: { id: b.id },
      data: { effectiveTo: now },
    });
  }
}

async function ensureRole(key) {
  const role = await db.roleDefinition.findFirst({ where: { key } });
  if (!role) {
    throw new Error(`RoleDefinition missing: ${key}`);
  }
  return role;
}

async function bind(roleKey, scopeType, scopeId, organizationId) {
  const role = await ensureRole(roleKey);
  await db.roleBinding.create({
    data: {
      principalId,
      roleDefinitionId: role.id,
      scopeType,
      organizationId: organizationId ?? null,
      scopeId: scopeId ?? null,
    },
  });
}

async function applyPersona(name) {
  await snapshotAndClear();
  switch (name) {
    case "org-admin":
      await bind("organization.admin", "ORGANIZATION", orgId, orgId);
      break;
    case "portfolio-manager":
      await bind("portfolio.manager", "ORGANIZATION", orgId, orgId);
      break;
    case "section-manager":
      await bind("section.manager", "SECTION", sectionId, orgId);
      break;
    case "department-manager":
      await bind("department.manager", "DEPARTMENT", departmentId, orgId);
      break;
    case "team-manager":
      await bind("team.manager", "TEAM", teamId, orgId);
      break;
    case "project-manager":
      await bind("project.manager", "DEPARTMENT", departmentId, orgId);
      break;
    case "viewer":
      await bind("organization.viewer", "ORGANIZATION", orgId, orgId);
      break;
    case "employee":
    case "contributor":
      // No dedicated ROLE_KEY for Employee/Contributor — organization.viewer
      // is the read-scoped pack used for contributor usability smoke (M5F-B).
      await bind("organization.viewer", "ORGANIZATION", orgId, orgId);
      break;
    case "pi-planner":
      // Section manager pack includes PI allocate/review (not baseline).
      await bind("section.manager", "SECTION", sectionId, orgId);
      break;
    case "governance-reviewer":
      // No dedicated ROLE_KEY — Org Admin pack includes approval.review.
      // Use org admin on QA org only for governance UI smoke.
      await bind("organization.admin", "ORGANIZATION", orgId, orgId);
      break;
    case "unbound":
      // No bindings — expect access-not-configured / empty shell.
      break;
    default:
      throw new Error(`Unknown persona: ${name}`);
  }
  console.log(
    JSON.stringify({
      ok: true,
      persona: name,
      principalId,
      organizationId: orgId,
    }),
  );
}

async function restoreBindings() {
  if (!fs.existsSync(statePath)) {
    console.log(JSON.stringify({ ok: true, restored: false, reason: "no-state" }));
    return;
  }
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  // Soft-end any current persona bindings
  const active = await db.roleBinding.findMany({
    where: { principalId, effectiveTo: null },
  });
  const now = new Date();
  for (const b of active) {
    await db.roleBinding.update({
      where: { id: b.id },
      data: { effectiveTo: now },
    });
  }
  // Re-open snapshot bindings
  for (const b of state.bindings) {
    const existing = await db.roleBinding.findUnique({ where: { id: b.id } });
    if (existing) {
      await db.roleBinding.update({
        where: { id: b.id },
        data: { effectiveTo: null },
      });
    } else {
      await db.roleBinding.create({
        data: {
          principalId,
          roleDefinitionId: b.roleDefinitionId,
          scopeType: b.scopeType,
          organizationId: b.organizationId,
          scopeId: b.scopeId,
        },
      });
    }
  }
  fs.unlinkSync(statePath);
  console.log(
    JSON.stringify({
      ok: true,
      restored: true,
      count: state.bindings.length,
    }),
  );
}

try {
  if (restore) {
    await restoreBindings();
  } else if (persona) {
    await applyPersona(persona);
  } else {
    throw new Error("Pass --persona=<name> or --restore");
  }
} finally {
  await db.$disconnect();
}
