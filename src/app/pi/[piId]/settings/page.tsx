import { notFound, redirect } from "next/navigation";
import {
  AddDepartmentForm,
  AddTeamForm,
  CreateIterationForm,
  RemoveDepartmentButton,
  RemoveTeamButton,
  UpdateIterationForm,
  UpdatePiForm,
} from "@/components/pi-planning/pi-forms";
import { PiTabs, piStatusLabel } from "@/components/pi-planning/pi-nav";
import {
  Breadcrumbs,
  PageHeader,
  Panel,
} from "@/components/ui/page";
import { resolveCapabilities } from "@/modules/identity-access/application/capabilities";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function PiSettingsPage({
  params,
}: {
  params: Promise<{ piId: string }>;
}) {
  const { piId } = await params;
  const { authz, organization, planning } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  let pi;
  try {
    pi = await planning.getProgramIncrement(principal, piId);
  } catch {
    notFound();
  }

  const capabilities = await resolveCapabilities(
    authz,
    principal,
    pi.organizationId,
  );

  const hierarchy = await organization.getHierarchy(
    principal,
    pi.organizationId,
  );

  const sections =
    hierarchy?.sections.map((s) => ({ id: s.id, name: s.name })) ?? [];

  const allDepartments =
    hierarchy?.sections.flatMap((s) =>
      s.departments.map((d) => ({
        id: d.id,
        name: d.name,
        sectionName: s.name,
        teams: d.teams.map((t) => ({
          id: t.id,
          name: t.name,
          departmentId: d.id,
        })),
      })),
    ) ?? [];

  const participatingDeptIds = new Set(
    pi.participatingDepartments.map((d) => d.departmentId),
  );
  const participatingTeamIds = new Set(
    pi.participatingTeams.map((t) => t.teamId),
  );

  const availableDepartments = allDepartments.filter(
    (d) => !participatingDeptIds.has(d.id),
  );

  const availableTeams = allDepartments
    .filter((d) => participatingDeptIds.has(d.id))
    .flatMap((d) =>
      d.teams
        .filter((t) => !participatingTeamIds.has(t.id))
        .map((t) => ({
          id: t.id,
          name: t.name,
          departmentId: d.id,
          departmentName: d.name,
        })),
    );

  const nextSequence =
    pi.iterations.reduce((max, it) => Math.max(max, it.sequence), 0) + 1;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "PI Planning", href: "/pi" },
          { label: pi.referenceKey, href: `/pi/${piId}` },
          { label: "Settings" },
        ]}
      />
      <PageHeader
        title="PI settings"
        description={`${pi.name} · ${piStatusLabel(pi.status)} — iterations and participation.`}
      />
      <PiTabs piId={piId} active="settings" />

      <div className="space-y-6">
        <Panel className="max-w-3xl">
          <UpdatePiForm
            pi={pi}
            sections={sections}
            capabilities={capabilities}
          />
        </Panel>

        <Panel>
          <h2 className="font-medium">Iterations</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Dates must fall within the PI window and must not overlap.
          </p>
          {pi.iterations.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No iterations yet.
            </p>
          ) : (
            <ul className="mt-4 space-y-4">
              {pi.iterations.map((it) => (
                <li key={it.id}>
                  <p className="text-sm font-medium">
                    {it.referenceKey} · {it.name}
                  </p>
                  <UpdateIterationForm
                    iteration={it}
                    piStart={pi.startDate}
                    piEnd={pi.endDate}
                    capabilities={capabilities}
                  />
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 max-w-xl border-t border-[var(--line)] pt-4">
            <CreateIterationForm
              piId={pi.id}
              nextSequence={nextSequence}
              piStart={pi.startDate}
              piEnd={pi.endDate}
              capabilities={capabilities}
            />
          </div>
        </Panel>

        <Panel>
          <h2 className="font-medium">Participating departments</h2>
          {pi.participatingDepartments.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No departments participate yet.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--line)]">
              {pi.participatingDepartments.map((pd) => (
                <li
                  key={pd.departmentId}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{pd.department.name}</p>
                    {pd.planningOwnerName ? (
                      <p className="text-xs text-[var(--muted)]">
                        Owner: {pd.planningOwnerName}
                      </p>
                    ) : null}
                  </div>
                  <RemoveDepartmentButton
                    piId={pi.id}
                    departmentId={pd.departmentId}
                    capabilities={capabilities}
                  />
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <AddDepartmentForm
              piId={pi.id}
              departments={availableDepartments}
              capabilities={capabilities}
            />
          </div>
        </Panel>

        <Panel>
          <h2 className="font-medium">Participating teams</h2>
          {pi.participatingTeams.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No teams participate yet. Add departments first, then teams.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--line)]">
              {pi.participatingTeams.map((pt) => (
                <li
                  key={pt.teamId}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <p className="font-medium">{pt.team.name}</p>
                  <RemoveTeamButton
                    piId={pi.id}
                    teamId={pt.teamId}
                    capabilities={capabilities}
                  />
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <AddTeamForm
              piId={pi.id}
              teams={availableTeams}
              capabilities={capabilities}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}
