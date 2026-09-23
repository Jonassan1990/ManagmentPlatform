"use server";

import { revalidatePath } from "next/cache";
import { AppError, toErrorPayload } from "@/modules/shared/errors";
import { createServices } from "@/server/container";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (error) {
    if (!(error instanceof AppError)) {
      console.error(error);
    }
    return { ok: false, error: toErrorPayload(error) };
  }
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
  return run(async () => {
    const { authz, planning } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await planning.createBaseline(principal, input);
    revalidatePi(result.piId);
    return result;
  });
}
