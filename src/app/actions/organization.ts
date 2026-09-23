"use server";

import { revalidatePath } from "next/cache";
import { AppError, toErrorPayload } from "@/modules/shared/errors";
import { createOrganizationService } from "@/server/container";

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

export async function createOrganizationAction(
  input: unknown,
): Promise<ActionResult> {
  return run(async () => {
    const { authz, organization } = createOrganizationService();
    const principal = await authz.requirePrincipal();
    const org = await organization.createOrganization(principal, input);
    revalidatePath("/");
    revalidatePath("/organization");
    return org;
  });
}

export async function updateOrganizationAction(
  input: unknown,
): Promise<ActionResult> {
  return run(async () => {
    const { authz, organization } = createOrganizationService();
    const principal = await authz.requirePrincipal();
    const org = await organization.updateOrganization(principal, input);
    revalidatePath("/organization");
    revalidatePath(`/organization/${org.id}`);
    return org;
  });
}

export async function createSectionAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const { authz, organization } = createOrganizationService();
    const principal = await authz.requirePrincipal();
    const section = await organization.createSection(principal, input);
    revalidatePath(`/organization/${section.organizationId}`);
    return section;
  });
}

export async function updateSectionAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const { authz, organization } = createOrganizationService();
    const principal = await authz.requirePrincipal();
    const section = await organization.updateSection(principal, input);
    revalidatePath(`/organization/${section.organizationId}`);
    revalidatePath(
      `/organization/${section.organizationId}/sections/${section.id}`,
    );
    return section;
  });
}

export async function createDepartmentAction(
  input: unknown,
): Promise<ActionResult> {
  return run(async () => {
    const { authz, organization } = createOrganizationService();
    const principal = await authz.requirePrincipal();
    const department = await organization.createDepartment(principal, input);
    const section = await organization.getSection(principal, department.sectionId);
    revalidatePath(`/organization/${section.organizationId}`);
    revalidatePath(
      `/organization/${section.organizationId}/sections/${section.id}`,
    );
    return department;
  });
}

export async function updateDepartmentAction(
  input: unknown,
): Promise<ActionResult> {
  return run(async () => {
    const { authz, organization } = createOrganizationService();
    const principal = await authz.requirePrincipal();
    const department = await organization.updateDepartment(principal, input);
    const full = await organization.getDepartment(principal, department.id);
    revalidatePath(`/organization/${full.section.organizationId}`);
    return department;
  });
}

export async function createTeamAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const { authz, organization } = createOrganizationService();
    const principal = await authz.requirePrincipal();
    const team = await organization.createTeam(principal, input);
    const department = await organization.getDepartment(
      principal,
      team.departmentId,
    );
    revalidatePath(`/organization/${department.section.organizationId}`);
    return team;
  });
}

export async function updateTeamAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const { authz, organization } = createOrganizationService();
    const principal = await authz.requirePrincipal();
    const team = await organization.updateTeam(principal, input);
    const full = await organization.getTeam(principal, team.id);
    revalidatePath(`/organization/${full.department.section.organizationId}`);
    return team;
  });
}

export async function createResourceAction(
  input: unknown,
): Promise<ActionResult> {
  return run(async () => {
    const { authz, organization } = createOrganizationService();
    const principal = await authz.requirePrincipal();
    const resource = await organization.createResource(principal, input);
    revalidatePath(`/organization/${resource.organizationId}`);
    revalidatePath(`/organization/${resource.organizationId}/resources`);
    return resource;
  });
}

export async function updateResourceAction(
  input: unknown,
): Promise<ActionResult> {
  return run(async () => {
    const { authz, organization } = createOrganizationService();
    const principal = await authz.requirePrincipal();
    const resource = await organization.updateResource(principal, input);
    revalidatePath(`/organization/${resource.organizationId}`);
    revalidatePath(
      `/organization/${resource.organizationId}/resources/${resource.id}`,
    );
    return resource;
  });
}

export async function assignMembershipAction(
  input: unknown,
): Promise<ActionResult> {
  return run(async () => {
    const { authz, organization } = createOrganizationService();
    const principal = await authz.requirePrincipal();
    const membership = await organization.assignMembership(principal, input);
    const resource = await organization.getResource(
      principal,
      membership.resourceId,
    );
    revalidatePath(`/organization/${resource.organizationId}`);
    return membership;
  });
}
