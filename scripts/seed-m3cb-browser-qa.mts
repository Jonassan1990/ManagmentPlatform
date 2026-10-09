/**
 * Idempotent browser QA seed for M3C-B (non-destructive — no table wipes).
 * Uses TEMP_AUTH principal + bootstrap token from .env.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { createServices } from "../src/server/container";
import type { Principal } from "../src/modules/identity-access/domain/types";

const OUT = path.join(
  process.cwd(),
  "artifacts/m3cb-qa/seed.json",
);

function principal(): Principal {
  const id = process.env.TEMP_AUTH_PRINCIPAL_ID;
  if (!id) throw new Error("TEMP_AUTH_PRINCIPAL_ID required");
  return {
    id,
    displayName: process.env.TEMP_AUTH_DISPLAY_NAME ?? "TempOwner",
    source: "temp",
  };
}

async function main() {
  const actor = principal();
  const { identity, organization, planning } = createServices();

  const consumed = await identity.isBootstrapConsumed();
  if (!consumed) {
    const token = process.env.BOOTSTRAP_SETUP_TOKEN;
    if (!token) throw new Error("BOOTSTRAP_SETUP_TOKEN required for empty DB");
    await identity.consumeBootstrapToken(actor, token);
    console.log("Bootstrap consumed for temp owner.");
  }

  let org = await organization
    .listOrganizations(actor)
    .then((list) => list.find((o) => o.name === "M3CB QA Org") ?? null)
    .catch(() => null);

  if (!org) {
    org = await organization.createOrganization(actor, {
      name: "M3CB QA Org",
      description: "Browser QA for scenario comparison UI",
    });
  }

  let section = (
    await organization.listSections(actor, org.id)
  ).find((s) => s.name === "Delivery");
  if (!section) {
    section = await organization.createSection(actor, {
      organizationId: org.id,
      name: "Delivery",
    });
  }

  let dept = (
    await organization.listDepartments(actor, section.id)
  ).find((d) => d.name === "Platform");
  if (!dept) {
    dept = await organization.createDepartment(actor, {
      sectionId: section.id,
      name: "Platform",
    });
  }

  let team = (await organization.listTeams(actor, dept.id)).find(
    (t) => t.name === "Team Alpha",
  );
  if (!team) {
    team = await organization.createTeam(actor, {
      departmentId: dept.id,
      name: "Team Alpha",
    });
  }

  let resource = (await organization.listResources(actor, org.id)).find(
    (r) => r.name === "Dev One",
  );
  if (!resource) {
    resource = await organization.createResource(actor, {
      organizationId: org.id,
      name: "Dev One",
      type: "PERSON",
      capacityHoursPerWeek: 40,
    });
    await organization.assignMembership(actor, {
      resourceId: resource.id,
      teamId: team.id,
      isPrimary: true,
      allocationPercent: 100,
    });
  }

  const pis = await planning.listProgramIncrements(actor, org.id);
  let pi = pis.find((p) => p.name === "M3CB Compare PI");
  const PI_START = new Date("2026-04-01T00:00:00.000Z");
  const PI_END = new Date("2026-06-30T00:00:00.000Z");
  const IT1_START = new Date("2026-04-01T00:00:00.000Z");
  const IT1_END = new Date("2026-04-14T00:00:00.000Z");

  if (!pi) {
    pi = await planning.createProgramIncrement(actor, {
      organizationId: org.id,
      sectionId: section.id,
      name: "M3CB Compare PI",
      startDate: PI_START,
      endDate: PI_END,
    });
    await planning.createIteration(actor, {
      piId: pi.id,
      name: "Iteration 1",
      sequence: 1,
      startDate: IT1_START,
      endDate: IT1_END,
    });
    pi = await planning.setParticipatingDepartments(actor, {
      piId: pi.id,
      departments: [{ departmentId: dept.id }],
    });
    pi = await planning.setParticipatingTeams(actor, {
      piId: pi.id,
      teams: [{ teamId: team.id, departmentId: dept.id }],
    });
    await planning.transitionStatus(actor, {
      piId: pi.id,
      targetStatus: "PLANNING",
    });
  }

  const scenarios = await planning.listScenarios(actor, pi.id, {
    includeArchived: true,
  });
  const current = scenarios.find((s) => s.isCurrent);
  if (!current) throw new Error("CURRENT revision missing");

  let scenarioA = scenarios.find((s) => s.label === "Scenario A");
  if (!scenarioA) {
    scenarioA = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "Scenario A",
    });
  }

  let scenarioB = scenarios.find((s) => s.label === "Scenario B");
  if (!scenarioB) {
    scenarioB = await planning.createScenarioFromCurrent(actor, {
      piId: pi.id,
      label: "Scenario B",
    });
  }

  const seed = {
    organizationId: org.id,
    piId: pi.id,
    currentRevisionId: current.id,
    scenarioAId: scenarioA.id,
    scenarioBId: scenarioB.id,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(seed, null, 2));
  console.log(JSON.stringify(seed, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
