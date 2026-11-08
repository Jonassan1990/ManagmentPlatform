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

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Delivery" },
        ]}
      />
      <PageHeader
        title="Delivery"
        description="Initiatives and projects follow one clear road map from idea to product. Each step has an explicit Go and No go."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/initiatives"
              className={buttonClassName({ variant: "primary", size: "sm" })}
            >
              Open initiatives
            </Link>
            <Link
              href="/portfolio/capacity"
              className={buttonClassName({ variant: "secondary", size: "sm" })}
            >
              Resource load
            </Link>
            <Link
              href="/portfolio/health"
              className={buttonClassName({ variant: "secondary", size: "sm" })}
            >
              Dependencies & health
            </Link>
          </div>
        }
      />

      {!canView ? (
        <EmptyState
          title="No initiative access yet"
          description="You need initiative view permission in an organization to open delivery work."
        />
      ) : (
        <div className="space-y-4">
          <Panel>
            <h2 className="mb-2 text-base font-semibold text-[var(--ink)]">
              Idea → product road map
            </h2>
            <p className="mb-4 text-sm text-[var(--muted)]">
              Formal governance decisions (Go / Conditional go / No go / Hold /
              Scale / Stop) are recorded on the initiative. Earlier steps advance
              when the work is ready; later steps require a gate decision.
            </p>
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
                      <span className="font-semibold text-[var(--ok)]">Go: </span>
                      <span className="text-[var(--muted)]">{step.goMeans}</span>
                    </p>
                    <p>
                      <span className="font-semibold text-[var(--danger)]">
                        No go:{" "}
                      </span>
                      <span className="text-[var(--muted)]">{step.noGoMeans}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          <div className="grid gap-4 md:grid-cols-3">
            <Panel>
              <h3 className="font-medium text-[var(--ink)]">Initiatives</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Create and run the idea → PoC → pilot → project journey with
                decision history.
              </p>
              <Link
                href="/initiatives"
                className="mt-3 inline-flex text-sm text-[var(--color-accent)] underline"
              >
                Browse initiatives
              </Link>
            </Panel>
            <Panel>
              <h3 className="font-medium text-[var(--ink)]">
                Allocations & workload
              </h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                See who is allocated and how loaded people are across delivery
                work.
              </p>
              <Link
                href="/portfolio/capacity"
                className="mt-3 inline-flex text-sm text-[var(--color-accent)] underline"
              >
                Open capacity
              </Link>
            </Panel>
            <Panel>
              <h3 className="font-medium text-[var(--ink)]">
                Cross-functional dependencies
              </h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Track blockers and cross-team dependencies that affect the road
                map.
              </p>
              <Link
                href="/portfolio/health"
                className="mt-3 inline-flex text-sm text-[var(--color-accent)] underline"
              >
                Open delivery health
              </Link>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
