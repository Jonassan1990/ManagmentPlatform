/**
 * M5B-C — Swap RoleBindings (+ optional Resource link) on temp-auth principal
 * for Home persona browser QA. Restores prior state on --restore.
 *
 * Personas: manager | employee | mixed | viewer | unbound | multi-org
 *
 * Usage:
 *   DATABASE_URL=... TEMP_AUTH_PRINCIPAL_ID=... node scripts/m5bc-switch-persona.mjs --persona=viewer
 *   DATABASE_URL=... TEMP_AUTH_PRINCIPAL_ID=... node scripts/m5bc-switch-persona.mjs --restore
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const principalId =
  process.env.TEMP_AUTH_PRINCIPAL_ID || process.env.QA_PRINCIPAL_ID;
if (!principalId) {
  throw new Error("TEMP_AUTH_PRINCIPAL_ID required");
}

const orgId =
  process.env.QA_ORG_ID ?? "f6b317a2-839d-413b-9aa1-2ea4e006f486";
const orgBId =
  process.env.QA_ORG_B_ID ?? "4cbdcdc6-e91f-4114-a9dd-971719348dc9";
const sectionId =
  process.env.QA_SECTION_ID ?? "ab6164ab-3fa2-4d87-adbb-afe36db6515a";
const departmentId =
  process.env.QA_DEPARTMENT_ID ?? "805efbca-cc27-4779-b85b-953daee3d10d";

const statePath =
  process.env.QA_PERSONA_STATE ??
  path.join(process.cwd(), "artifacts/m5bc-acceptance/persona-state.json");

const args = process.argv.slice(2);
const restore = args.includes("--restore");
const personaArg = args.find((a) => a.startsWith("--persona="));
const persona = personaArg ? personaArg.split("=")[1] : null;

async function snapshotAndClear() {
  const active = await db.roleBinding.findMany({
    where: { principalId, effectiveTo: null },
  });
  const linked = await db.resource.findMany({
    where: { linkedPrincipalId: principalId, status: "ACTIVE" },
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
          linkedResourceIds: linked.map((r) => r.id),
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
  // Unlink for persona control; restore will re-link snapshot ids.
  for (const r of linked) {
    await db.resource.update({
      where: { id: r.id },
      data: { linkedPrincipalId: null },
    });
  }
}

async function ensureRole(key) {
  const role = await db.roleDefinition.findFirst({ where: { key } });
  if (!role) throw new Error(`RoleDefinition missing: ${key}`);
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

async function ensureLinkedResource(name) {
  let resource = await db.resource.findFirst({
    where: {
      organizationId: orgId,
      name,
      type: "PERSON",
    },
  });
  if (!resource) {
    resource = await db.resource.create({
      data: {
        id: randomUUID(),
        organizationId: orgId,
        name,
        type: "PERSON",
        status: "ACTIVE",
        skillsJson: [],
        capacityHoursPerWeek: 40,
        linkedPrincipalId: principalId,
      },
    });
  } else {
    await db.resource.update({
      where: { id: resource.id },
      data: { linkedPrincipalId: principalId, status: "ACTIVE" },
    });
  }

  // Ensure at least one owned project for My Work visibility when possible.
  const owned = await db.project.findFirst({
    where: { organizationId: orgId, ownerResourceId: resource.id },
  });
  if (!owned) {
    const project = await db.project.findFirst({
      where: { organizationId: orgId, status: "ACTIVE" },
    });
    if (project) {
      await db.project.update({
        where: { id: project.id },
        data: { ownerResourceId: resource.id },
      });
    }
  }
  return resource;
}

async function applyPersona(name) {
  await snapshotAndClear();
  switch (name) {
    case "manager":
      await bind("organization.admin", "ORGANIZATION", orgId, orgId);
      // Explicitly no linked resource (manager mode).
      break;
    case "employee":
      await bind("organization.viewer", "ORGANIZATION", orgId, orgId);
      await ensureLinkedResource("M5BC Employee Fixture");
      break;
    case "mixed":
      await bind("portfolio.manager", "ORGANIZATION", orgId, orgId);
      await ensureLinkedResource("M5BC Mixed Fixture");
      break;
    case "viewer":
      await bind("organization.viewer", "ORGANIZATION", orgId, orgId);
      break;
    case "unbound":
      break;
    case "multi-org":
      await bind("organization.admin", "ORGANIZATION", orgId, orgId);
      await bind("organization.admin", "ORGANIZATION", orgBId, orgBId);
      break;
    case "department-manager":
      await bind("department.manager", "DEPARTMENT", departmentId, orgId);
      break;
    case "section-manager":
      await bind("section.manager", "SECTION", sectionId, orgId);
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
    console.log(
      JSON.stringify({ ok: true, restored: false, reason: "no-state" }),
    );
    return;
  }
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const now = new Date();
  const active = await db.roleBinding.findMany({
    where: { principalId, effectiveTo: null },
  });
  for (const b of active) {
    await db.roleBinding.update({
      where: { id: b.id },
      data: { effectiveTo: now },
    });
  }
  // Clear any QA fixture links first
  await db.resource.updateMany({
    where: { linkedPrincipalId: principalId },
    data: { linkedPrincipalId: null },
  });
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
  for (const rid of state.linkedResourceIds ?? []) {
    await db.resource
      .update({
        where: { id: rid },
        data: { linkedPrincipalId: principalId },
      })
      .catch(() => undefined);
  }
  fs.unlinkSync(statePath);
  console.log(JSON.stringify({ ok: true, restored: true }));
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
