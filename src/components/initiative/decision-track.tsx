import Link from "next/link";
import type { DecisionTrackStep } from "@/modules/initiative/application/decision-track";
import { StatusBadge } from "@/components/ui/status-badge";

function verdictBadge(verdict: DecisionTrackStep["verdict"]): {
  status: "approved" | "pending" | "cancelled" | "in-progress" | "blocked";
  label: string;
} {
  switch (verdict) {
    case "GO":
      return { status: "approved", label: "Go" };
    case "CONDITIONAL_GO":
      return { status: "approved", label: "Conditional go" };
    case "NO_GO":
      return { status: "cancelled", label: "No go" };
    case "HOLD":
      return { status: "blocked", label: "Hold" };
    case "PENDING":
      return { status: "pending", label: "Awaiting decision" };
    case "IN_PROGRESS":
      return { status: "in-progress", label: "In progress" };
    default:
      return { status: "pending", label: "Not started" };
  }
}

export function DecisionTrackPanel({
  initiativeId,
  steps,
}: {
  initiativeId: string;
  steps: DecisionTrackStep[];
}) {
  return (
    <section
      className="space-y-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] px-3 py-4 sm:px-4"
      aria-label="Go / no-go decision track"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[var(--ink)]">
            Idea → product decision track
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Every stage has an explicit Go or No go meaning. Formal gates record
            the decision; earlier stages advance when work is ready.
          </p>
        </div>
        <Link
          href={`/initiatives/${initiativeId}/decisions`}
          className="text-sm text-[var(--color-accent)] underline"
        >
          Open decision log
        </Link>
      </div>

      <ol className="space-y-3">
        {steps.map((step, index) => {
          const badge = verdictBadge(step.verdict);
          const href =
            step.hrefPath === ""
              ? `/initiatives/${initiativeId}`
              : `/initiatives/${initiativeId}/${step.hrefPath}`;
          return (
            <li
              key={step.id}
              className="rounded-md border border-[var(--line)] p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-[var(--ink)]">
                    <span className="mr-2 text-[var(--muted)]">
                      {index + 1}.
                    </span>
                    {step.label}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {step.description}
                  </p>
                </div>
                <StatusBadge status={badge.status} label={badge.label} />
              </div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
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
              {step.detail ? (
                <p className="mt-2 text-xs text-[var(--muted)]">{step.detail}</p>
              ) : null}
              <p className="mt-2 text-sm">
                <Link
                  href={href}
                  className="text-[var(--color-accent)] underline"
                >
                  Open {step.label}
                </Link>
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
