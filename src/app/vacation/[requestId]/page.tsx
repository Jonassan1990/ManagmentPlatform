import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CancelVacationButton,
  ResubmitVacationForm,
  ReviewVacationForm,
} from "@/components/vacation/vacation-forms";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status-badge";
import { AppError } from "@/modules/shared/errors";
import {
  mapVacationAuditLabel,
  mapVacationStatusBadge,
} from "@/modules/vacation/application/vacation-status";
import {
  formatVacationAmount,
  formatVacationSpan,
} from "@/modules/vacation/application/vacation-duration";
import { formatDateOnly } from "@/modules/vacation/application/working-days";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function VacationDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const { authz, vacation } = createServices();
  await authz.ensureSystemRoles();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  let detail;
  try {
    detail = await vacation.getRequest(principal, requestId);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    if (error instanceof AppError && error.code === "FORBIDDEN") redirect("/vacation");
    throw error;
  }

  const { request, audits, capabilities } = detail;
  const badge = mapVacationStatusBadge(request.status);
  const approverNames = request.approvers.map((approver) => approver.displayName);
  const waiting =
    request.status === "SUBMITTED" || request.status === "CHANGES_REQUESTED";

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Vacation", href: "/vacation" },
          { label: "Request" },
        ]}
      />
      <PageHeader
        title={formatVacationSpan(
          request.startDate,
          request.endDate,
          request.durationKind,
        )}
        description={`Owner ${request.requesterDisplayName} · Approver ${
          approverNames.length > 0 ? approverNames.join(", ") : "not assigned"
        } · ${formatVacationAmount(request)}`}
        actions={<StatusBadge status={badge.status} label={badge.label} />}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Panel>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Owner
          </p>
          <p className="mt-1 text-base font-semibold text-[var(--ink)]">
            {request.requesterDisplayName}
          </p>
          <p className="text-sm text-[var(--muted)]">
            {request.placement ?? "No department assigned"}
          </p>
        </Panel>
        <Panel>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Approver
          </p>
          {request.approvers.length === 0 ? (
            <p className="mt-1 text-base font-semibold text-[var(--ink)]">
              No approver assigned
            </p>
          ) : (
            <ul className="mt-1 space-y-2">
              {request.approvers.map((approver) => (
                <li key={approver.principalId}>
                  <p className="text-base font-semibold text-[var(--ink)]">
                    {approver.displayName}
                  </p>
                  <p className="text-sm text-[var(--muted)]">{approver.roleName}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-sm text-[var(--muted)]">
            {waiting
              ? "Waiting for approval"
              : request.reviewerDisplayName
                ? `Decision by ${request.reviewerDisplayName}`
                : "No decision recorded"}
          </p>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="mb-4 text-base font-semibold text-[var(--ink)]">Details</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-[var(--muted)]">Owner</dt>
              <dd className="font-medium text-[var(--ink)]">
                {request.requesterDisplayName}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Approver</dt>
              <dd className="font-medium text-[var(--ink)]">
                {approverNames.length > 0 ? approverNames.join(", ") : "Not assigned"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Dates</dt>
              <dd className="font-medium text-[var(--ink)]">
                {formatVacationSpan(
                  request.startDate,
                  request.endDate,
                  request.durationKind,
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Length</dt>
              <dd className="font-medium text-[var(--ink)]">
                {formatVacationAmount(request)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Reason</dt>
              <dd className="text-[var(--ink)]">{request.reason || "—"}</dd>
            </div>
            {request.managerComment ? (
              <div>
                <dt className="text-[var(--muted)]">Manager comment</dt>
                <dd className="text-[var(--ink)]">{request.managerComment}</dd>
              </div>
            ) : null}
            {request.reviewerDisplayName ? (
              <div>
                <dt className="text-[var(--muted)]">Reviewed by</dt>
                <dd className="text-[var(--ink)]">
                  {request.reviewerDisplayName}
                  {request.reviewedAt
                    ? ` · ${request.reviewedAt.toISOString().slice(0, 10)}`
                    : ""}
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="mt-6 space-y-4">
            {capabilities.canEditResubmit ? (
              <ResubmitVacationForm
                requestId={request.id}
                expectedVersion={request.version}
                durationKind={request.durationKind}
                startDate={formatDateOnly(request.startDate)}
                endDate={formatDateOnly(request.endDate)}
                dayPart={request.dayPart}
                hours={request.hours}
                reason={request.reason}
              />
            ) : null}
            {capabilities.canCancel ? (
              <CancelVacationButton
                requestId={request.id}
                expectedVersion={request.version}
              />
            ) : null}
            {capabilities.canReview &&
            (request.status === "SUBMITTED" ||
              request.status === "CHANGES_REQUESTED") ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-[var(--ink)]">
                  Manager decision
                </h3>
                <ReviewVacationForm
                  requestId={request.id}
                  expectedVersion={request.version}
                />
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-base font-semibold text-[var(--ink)]">Audit history</h2>
          {audits.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No audit entries yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)] text-[10px] uppercase tracking-wide text-[var(--muted)]">
                    <th className="py-2 pr-3 font-semibold">When</th>
                    <th className="py-2 pr-3 font-semibold">Action</th>
                    <th className="py-2 pr-3 font-semibold">By</th>
                    <th className="py-2 font-semibold">Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {audits.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-[var(--line)] align-top"
                    >
                      <td className="py-2 pr-3 whitespace-nowrap text-[var(--muted)]">
                        {row.createdAt.toISOString().replace("T", " ").slice(0, 16)}{" "}
                        UTC
                      </td>
                      <td className="py-2 pr-3 font-medium text-[var(--ink)]">
                        {mapVacationAuditLabel(row.action)}
                        {row.fromStatus || row.toStatus ? (
                          <span className="block text-xs font-normal text-[var(--muted)]">
                            {row.fromStatus ?? "—"} → {row.toStatus ?? "—"}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3">{row.actorDisplayName}</td>
                      <td className="py-2 text-[var(--muted)]">
                        {row.comment || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-4 text-xs text-[var(--muted)]">
            Stored in <code>vacation_request_audits</code>. Also mirrored to
            platform audit events.
          </p>
          <p className="mt-2 text-sm">
            <Link href="/vacation" className="text-[var(--color-accent)] underline">
              Back to my requests
            </Link>
          </p>
        </Panel>
      </div>
    </div>
  );
}
