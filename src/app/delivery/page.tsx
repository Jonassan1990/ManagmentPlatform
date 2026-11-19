import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClassName } from "@/components/ui/button";
import {
  Breadcrumbs,
  EmptyState,
  PageHeader,
  Panel,
} from "@/components/ui/page";
import { DELIVERY_ROADMAP } from "@/modules/initiative/application/decision-track";
import { PERMISSIONS } from "@/modules/shared/permissions";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function DeliveryHubPage() {
  const { authz, organization } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  const orgs = await organization.listOrganizations(principal);
  const orgId = orgs[0]?.id ?? null;
  const canView = orgId
    ? await authz.hasPermissionInOrganization(
        principal,
        PERMISSIONS.INITIATIVE_VIEW,
        orgId,
      )
    : false;
  const canCreate = orgId
    ? await authz.hasPermissionInOrganization(
        principal,
        PERMISSIONS.INITIATIVE_CREATE,
        orgId,
      )
    : false;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "How stages work" },
        ]}
      />
      <PageHeader
        title="How an idea moves forward"
        description="One path: capture the idea → get approval → document the decision → next stage. Ownership stays visible the whole way."
        actions={
          <div className="flex flex-wrap gap-2">
            {canCreate ? (
              <Link
                href="/initiatives/new"
                className={buttonClassName({ variant: "primary", size: "sm" })}
              >
                New idea
              </Link>
            ) : null}
            <Link
              href="/initiatives"
              className={buttonClassName({ variant: "secondary", size: "sm" })}
            >
              Ideas & initiatives
            </Link>
            <Link
              href="/approvals"
              className={buttonClassName({ variant: "secondary", size: "sm" })}
            >
              Approvals
            </Link>
            <Link
              href="/decisions"
              className={buttonClassName({ variant: "secondary", size: "sm" })}
            >
              Decisions
            </Link>
          </div>
        }
      />

      {!canView ? (
        <EmptyState
          title="No initiative access yet"
          description="You need initiative view permission in an organization to open this path."
        />
      ) : (
        <div className="space-y-4">
          <Panel>
            <h2 className="mb-2 text-base font-semibold text-[var(--ink)]">
              What you do at each step
            </h2>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--ink)]">
              <li>
                <strong>New idea</strong> — write the need, name a requester and
                business owner.
              </li>
              <li>
                <strong>Work the stage</strong> — demand, requirements,
                pre-study, PoC, pilot, or project tabs on the initiative.
              </li>
              <li>
                <strong>Ask for approval</strong> — submit a gate package when
                the stage is ready.
              </li>
              <li>
                <strong>Decide & document</strong> — Go / Conditional / No go /
                Hold with a named decision owner.
              </li>
              <li>
                <strong>Advance</strong> — only after a Go (or early-stage
                ready) does the initiative move on.
              </li>
            </ol>
          </Panel>

          <Panel>
            <h2 className="mb-2 text-base font-semibold text-[var(--ink)]">
              Stage guide (Go / No go)
            </h2>
            <ol className="space-y-3">
              {DELIVERY_ROADMAP.map((step, index) => (
                <li
                  key={step.id}
                  className="rounded-md border border-[var(--line)] p-3"
                >
                  <p className="font-medium text-[var(--ink)]">
                    {index + 1}. {step.label}
                  </p>
                  <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                    <p>
                      <span className="font-semibold text-[var(--ok)]">
                        Go:{" "}
                      </span>
                      <span className="text-[var(--muted)]">
                        {step.goMeans}
                      </span>
                    </p>
                    <p>
                      <span className="font-semibold text-[var(--danger)]">
                        No go:{" "}
                      </span>
                      <span className="text-[var(--muted)]">
                        {step.noGoMeans}
                      </span>
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          <div className="grid gap-4 md:grid-cols-3">
            <Panel>
              <h3 className="font-medium text-[var(--ink)]">
                People & budget
              </h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                See allocations, workload, and cost on Portfolio Capacity and
                the project page.
              </p>
              <Link
                href="/portfolio/capacity"
                className="mt-3 inline-flex text-sm text-[var(--color-accent)] underline"
              >
                Capacity & workload
              </Link>
            </Panel>
            <Panel>
              <h3 className="font-medium text-[var(--ink)]">
                Vacation & handover
              </h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Check cover before approving leave so ownership is not left
                hanging.
              </p>
              <Link
                href="/vacation/cover"
                className="mt-3 inline-flex text-sm text-[var(--color-accent)] underline"
              >
                Cover & handover
              </Link>
            </Panel>
            <Panel>
              <h3 className="font-medium text-[var(--ink)]">Approvals inbox</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Leave requests and governance packages waiting on you.
              </p>
              <Link
                href="/approvals"
                className="mt-3 inline-flex text-sm text-[var(--color-accent)] underline"
              >
                Open approvals
              </Link>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
