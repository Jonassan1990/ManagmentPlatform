"use server";

import { revalidatePath } from "next/cache";
import { createServices } from "@/server/container";
import { runAction, type ActionResult } from "@/server/action-runner";

export type { ActionResult };

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  return runAction("server_action", fn);
}

function revalidatePi(piId?: string, organizationId?: string) {
  revalidatePath("/");
  revalidatePath("/pi");
  revalidatePath("/pi/new");
  if (piId) {
    revalidatePath(`/pi/${piId}`);
    revalidatePath(`/pi/${piId}/board`);
    revalidatePath(`/pi/${piId}/capacity`);
    revalidatePath(`/pi/${piId}/dependencies`);
    revalidatePath(`/pi/${piId}/review`);
    revalidatePath(`/pi/${piId}/baseline`);
    revalidatePath(`/pi/${piId}/settings`);
    revalidatePath(`/pi/${piId}/compare`);
  }
  if (organizationId) {
    revalidatePath(`/organization/${organizationId}`);
  }
}

function piIdFrom(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  if (typeof record.piId === "string") return record.piId;
  return null;
}

export async function createPIAction(input: unknown) {
  return run(async () => {
    const { authz, planning } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await planning.createProgramIncrement(principal, input);
    revalidatePi(result.id, result.organizationId);
    return result;
  });
}

export async function updatePIAction(input: unknown) {
  return run(async () => {
    const { authz, planning } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await planning.updateProgramIncrement(principal, input);
    revalidatePi(result.id, result.organizationId);
    return result;
  });
}

export async function transitionPIAction(input: unknown) {
  return run(async () => {
    const { authz, planning } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await planning.transitionStatus(principal, input);
    revalidatePi(result.id, result.organizationId);
    return result;
  });
}

export async function createIterationAction(input: unknown) {
  return run(async () => {
    const { authz, planning } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await planning.createIteration(principal, input);
    const piId = piIdFrom(input) ?? result.piId;
    revalidatePi(piId);
    return result;
  });
}

export async function updateIterationAction(input: unknown) {
  return run(async () => {
    const { authz, planning } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await planning.updateIteration(principal, input);
    revalidatePi(result.piId);
    return result;
  });
}

export async function setParticipatingDepartmentsAction(input: unknown) {
  return run(async () => {
    const { authz, planning } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await planning.setParticipatingDepartments(principal, input);
    revalidatePi(result.id, result.organizationId);
    return result;
  });
}

export async function setParticipatingTeamsAction(input: unknown) {
  return run(async () => {
    const { authz, planning } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await planning.setParticipatingTeams(principal, input);
    revalidatePi(result.id, result.organizationId);
    return result;
  });
}

/** Add one participating department (read-modify-write via set). */
export async function addParticipatingDepartmentAction(input: {
  piId: string;
  departmentId: string;
  planningOwnerName?: string | null;
}) {
  return run(async () => {
    const { authz, planning } = createServices();
    const principal = await authz.requirePrincipal();
    const pi = await planning.getProgramIncrement(principal, input.piId);
    const departments = [
      ...pi.participatingDepartments.map((d) => ({
        departmentId: d.departmentId,
        planningOwnerName: d.planningOwnerName,
      })),
      {
        departmentId: input.departmentId,
        planningOwnerName: input.planningOwnerName ?? null,
      },
    ];
    const unique = new Map(
      departments.map((d) => [d.departmentId, d] as const),
    );
    const result = await planning.setParticipatingDepartments(principal, {
      piId: input.piId,
      departments: [...unique.values()],
    });
    revalidatePi(result.id, result.organizationId);
    return result;
  });
}

export async function removeParticipatingDepartmentAction(input: {
  piId: string;
  departmentId: string;
}) {
  return run(async () => {
    const { authz, planning } = createServices();
    const principal = await authz.requirePrincipal();
    const pi = await planning.getProgramIncrement(principal, input.piId);
    const departments = pi.participatingDepartments
      .filter((d) => d.departmentId !== input.departmentId)
      .map((d) => ({
        departmentId: d.departmentId,
        planningOwnerName: d.planningOwnerName,
      }));
    const result = await planning.setParticipatingDepartments(principal, {
      piId: input.piId,
      departments,
    });
    revalidatePi(result.id, result.organizationId);
    return result;
  });
}

export async function addParticipatingTeamAction(input: {
  piId: string;
  teamId: string;
  departmentId: string;
}) {
  return run(async () => {
    const { authz, planning } = createServices();
    const principal = await authz.requirePrincipal();
    const pi = await planning.getProgramIncrement(principal, input.piId);
    const teams = [
      ...pi.participatingTeams.map((t) => ({
        teamId: t.teamId,
        departmentId: t.departmentId,
      })),
      { teamId: input.teamId, departmentId: input.departmentId },
    ];
    const unique = new Map(teams.map((t) => [t.teamId, t] as const));
    const result = await planning.setParticipatingTeams(principal, {
      piId: input.piId,
      teams: [...unique.values()],
    });
    revalidatePi(result.id, result.organizationId);
    return result;
  });
}

export async function removeParticipatingTeamAction(input: {
  piId: string;
  teamId: string;
}) {
  return run(async () => {
    const { authz, planning } = createServices();
    const principal = await authz.requirePrincipal();
    const pi = await planning.getProgramIncrement(principal, input.piId);
    const teams = pi.participatingTeams
      .filter((t) => t.teamId !== input.teamId)
      .map((t) => ({
        teamId: t.teamId,
        departmentId: t.departmentId,
      }));
    const result = await planning.setParticipatingTeams(principal, {
      piId: input.piId,
      teams,
    });
    revalidatePi(result.id, result.organizationId);
    return result;
  });
}

export async function allocateWorkAction(input: unknown) {
  return run(async () => {
    const { authz, planning } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await planning.allocateWork(principal, input);
    revalidatePi(piIdFrom(input) ?? undefined);
    return result;
  });
}

export async function moveAllocationAction(input: unknown) {
  return run(async () => {
    const { authz, planning } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await planning.moveAllocation(principal, input);
    revalidatePi(piIdFrom(input) ?? undefined);
    return result;
  });
}

export async function removeAllocationAction(input: unknown) {
  return run(async () => {
    const { authz, planning } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await planning.removeAllocation(principal, input);
    revalidatePi(piIdFrom(input) ?? undefined);
    return result;
  });
}

export async function setResourceAvailabilityAction(input: unknown) {
  return run(async () => {
    const { authz, planning } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await planning.setResourceAvailability(principal, input);
    revalidatePi(piIdFrom(input) ?? undefined);
    return result;
  });
}

export async function createDependencyAction(input: unknown) {
  return run(async () => {
    const { authz, planning } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await planning.createDependency(principal, input);
    revalidatePi(piIdFrom(input) ?? undefined, result.organizationId);
    return result;
  });
}

export async function updateDependencyAction(input: unknown) {
  return run(async () => {
    const { authz, planning } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await planning.updateDependency(principal, input);
    revalidatePi(piIdFrom(input) ?? undefined, result.organizationId);
    return result;
  });
}

export async function createBaselineAction(input: unknown) {
  return runAction("pi.baseline.create", async () => {
    const { authz, planning } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await planning.createBaseline(principal, input);
    revalidatePi(result.piId);
    revalidatePath("/portfolio");
    return result;
  });
}

export async function approveCurrentPlanAction(input: unknown) {
  return runAction("pi.plan.approve", async () => {
    const { authz, planning } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await planning.approveCurrentPlan(principal, input);
    revalidatePi(result.piId);
    return result;
  });
}

export async function createScenarioFromCurrentAction(input: unknown) {
  return run(async () => {
    const { authz, planning } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await planning.createScenarioFromCurrent(principal, input);
    revalidatePi(result.piId);
    return result;
  });
}

export async function cloneScenarioAction(input: unknown) {
  return run(async () => {
    const { authz, planning } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await planning.cloneScenario(principal, input);
    revalidatePi(result.piId);
    return result;
  });
}

export async function renameScenarioAction(input: unknown) {
  return run(async () => {
    const { authz, planning } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await planning.renameScenario(principal, input);
    revalidatePi(result.piId);
    return result;
  });
}

export async function archiveScenarioAction(input: unknown) {
  return run(async () => {
    const { authz, planning } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await planning.archiveScenario(principal, input);
    revalidatePi(result.piId);
    return result;
  });
}

export async function markScenarioReadyAction(input: unknown) {
  return run(async () => {
    const { authz, planning } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await planning.markScenarioReady(principal, input);
    revalidatePi(result.piId);
    return result;
  });
}

export async function reopenScenarioAction(input: unknown) {
  return run(async () => {
    const { authz, planning } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await planning.reopenScenario(principal, input);
    revalidatePi(result.piId);
    return result;
  });
}

export async function selectScenarioAction(input: unknown) {
  return runAction("pi.scenario.select", async () => {
    const { authz, planning } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await planning.selectScenario(principal, input);
    revalidatePi(result.piId);
    return result;
  });
}

export async function clearScenarioSelectionAction(input: unknown) {
  return run(async () => {
    const { authz, planning } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await planning.clearScenarioSelection(principal, input);
    revalidatePi(result.piId);
    return result;
  });
}

export async function promoteSelectedScenarioAction(input: unknown) {
  return runAction("pi.scenario.promote", async () => {
    const { authz, planning } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await planning.promoteSelectedScenario(principal, input);
    revalidatePi(result.piId);
    revalidatePath("/portfolio");
    return result;
  });
}
