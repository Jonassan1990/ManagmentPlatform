import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EditOnboardingItems } from "@/components/onboarding/edit-onboarding-items";
import {
  OnboardingSheet,
  type SheetTask,
} from "@/components/onboarding/onboarding-sheet";
import {
  CancelOnboardingButton,
  ToggleOnboardingCheckButton,
} from "@/components/onboarding/onboarding-forms";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status-badge";
import { AppError } from "@/modules/shared/errors";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

function mapStatus(status: string) {
  switch (status) {
    case "PASSED":
      return { status: "approved" as const, label: "Officially passed" };
    case "CANCELLED":
      return { status: "cancelled" as const, label: "Cancelled" };
    default:
      return { status: "in-progress" as const, label: "In progress" };
  }
}

export default async function OnboardingDetailPage({
  params,
}: {
  params: Promise<{ checklistId: string }>;
}) {
  const { checklistId } = await params;
  const { authz, onboarding } = createServices();
  await authz.ensureSystemRoles();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  let detail;
  try {
    detail = await onboarding.getChecklist(principal, checklistId);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    if (error instanceof AppError && error.code === "FORBIDDEN") {
      redirect("/onboarding");
    }
    throw error;
  }

  const { checklist, audits, capabilities } = detail;
  const badge = mapStatus(checklist.status);
  const sheetTasks: SheetTask[] = checklist.items.flatMap((item) => {
    if (
      item.phase !== "PREBOARDING" &&
      item.phase !== "FIRST_WEEK" &&
      item.phase !== "FIRST_30_DAYS" &&
      item.phase !== "FEEDBACK"
    ) {
      return [];
    }
    return [
      {
        id: item.id,
        title: item.title,
        description: item.description,
        phase: item.phase,
        assigneeLabel: item.assigneeLabel,
        dueDate: item.dueDate ? item.dueDate.toISOString().slice(0, 10) : null,
        taskStatus: item.taskStatus,
        notes: item.notes,
      },
    ];
  });
  const useSheet = sheetTasks.length > 0;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Onboarding", href: "/onboarding" },
          { label: "Checklist" },
        ]}
      />
      <PageHeader
        title={checklist.title}
        description={`Employee: ${checklist.employeeDisplayName} · Onboarder: ${checklist.onboarderDisplayName}`}
        actions={<StatusBadge status={badge.status} label={badge.label} />}
      />

      {useSheet ? null : (
      <Panel className="mb-6">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-md border border-[var(--line)] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Dual complete
            </p>
            <p className="mt-1 text-lg font-semibold text-[var(--ink)]">
              {checklist.progress.dualDone}/{checklist.progress.total}
            </p>
          </div>
          <div className="rounded-md border border-[var(--line)] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Employee checks
            </p>
            <p className="mt-1 text-lg font-semibold text-[var(--ink)]">
              {checklist.progress.employeeDone}/{checklist.progress.total}
            </p>
          </div>
          <div className="rounded-md border border-[var(--line)] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Onboarder checks
            </p>
            <p className="mt-1 text-lg font-semibold text-[var(--ink)]">
              {checklist.progress.onboarderDone}/{checklist.progress.total}
            </p>
          </div>
          <div className="rounded-md border border-[var(--line)] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Official pass
            </p>
            <p className="mt-1 text-lg font-semibold text-[var(--ink)]">
              {checklist.progress.officiallyPassed || checklist.status === "PASSED"
                ? "Yes"
                : "Not yet"}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">
          An item counts only when <strong>both</strong> the new employee and
          the onboarder have checked it. When every item is dual-checked, the
          checklist becomes officially passed.
        </p>
      </Panel>
      )}

      {useSheet ? (
        <div className="mb-6">
          <OnboardingSheet
            checklistId={checklist.id}
            expectedVersion={checklist.version}
            editable={
              checklist.status === "IN_PROGRESS" &&
              (capabilities.canToggleEmployee ||
                capabilities.canToggleOnboarder ||
                capabilities.canManage)
            }
            profile={{
              employeeName: checklist.employeeDisplayName,
              jobTitle: checklist.jobTitle,
              department: checklist.departmentLabel,
              hiringManager: checklist.hiringManagerName,
              startDate: checklist.startDate
                ? checklist.startDate.toISOString().slice(0, 10)
                : null,
              onboarderName: checklist.onboarderDisplayName,
            }}
            tasks={sheetTasks}
          />
          {capabilities.canManage && checklist.status === "IN_PROGRESS" ? (
            <div className="mt-4">
              <CancelOnboardingButton
                checklistId={checklist.id}
                expectedVersion={checklist.version}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {useSheet ? null : (
        <Panel>
          <h2 className="mb-4 text-base font-semibold text-[var(--ink)]">
            Checklist items
          </h2>
          <ul className="space-y-4">
            {checklist.items.map((item) => (
              <li
                key={item.id}
                className="rounded-md border border-[var(--line)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-[var(--ink)]">
                      {item.sortOrder}. {item.title}
                    </p>
                    {item.description ? (
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge
                    status={item.dualComplete ? "approved" : "pending"}
                    label={item.dualComplete ? "Both checked" : "Waiting"}
                  />
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <ToggleOnboardingCheckButton
                    checklistId={checklist.id}
                    itemId={item.id}
                    expectedVersion={checklist.version}
                    role="EMPLOYEE"
                    checked={Boolean(item.employeeCheckedAt)}
                    disabled={!capabilities.canToggleEmployee}
                    label={`Employee check (${checklist.employeeDisplayName})`}
                  />
                  <ToggleOnboardingCheckButton
                    checklistId={checklist.id}
                    itemId={item.id}
                    expectedVersion={checklist.version}
                    role="ONBOARDER"
                    checked={Boolean(item.onboarderCheckedAt)}
                    disabled={!capabilities.canToggleOnboarder}
                    label={`Onboarder check (${checklist.onboarderDisplayName})`}
                  />
                </div>
              </li>
            ))}
          </ul>
          {capabilities.canManage && checklist.status === "IN_PROGRESS" ? (
            <div className="mt-6 space-y-6">
              <EditOnboardingItems
                checklistId={checklist.id}
                expectedVersion={checklist.version}
                items={checklist.items.map((item) => ({
                  id: item.id,
                  title: item.title,
                  description: item.description,
                }))}
              />
              <CancelOnboardingButton
                checklistId={checklist.id}
                expectedVersion={checklist.version}
              />
            </div>
          ) : null}
        </Panel>
        )}

        <Panel className={useSheet ? "lg:col-span-2" : undefined}>
          <h2 className="mb-4 text-base font-semibold text-[var(--ink)]">
            Audit history
          </h2>
          {audits.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No audit entries yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[360px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)] text-[10px] uppercase tracking-wide text-[var(--muted)]">
                    <th className="py-2 pr-3 font-semibold">When</th>
                    <th className="py-2 pr-3 font-semibold">Action</th>
                    <th className="py-2 font-semibold">By</th>
                  </tr>
                </thead>
                <tbody>
                  {audits.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-[var(--line)] align-top"
                    >
                      <td className="py-2 pr-3 whitespace-nowrap text-[var(--muted)]">
                        {row.createdAt
                          .toISOString()
                          .replace("T", " ")
                          .slice(0, 16)}{" "}
                        UTC
                      </td>
                      <td className="py-2 pr-3 font-medium text-[var(--ink)]">
                        {row.action.replaceAll("_", " ")}
                        {row.comment ? (
                          <span className="block text-xs font-normal text-[var(--muted)]">
                            {row.comment}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2">{row.actorDisplayName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-4 text-sm">
            <Link
              href="/onboarding"
              className="text-[var(--color-accent)] underline"
            >
              Back to onboarding
            </Link>
          </p>
        </Panel>
      </div>
    </div>
  );
}
