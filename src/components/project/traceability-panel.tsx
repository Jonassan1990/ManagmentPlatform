import Link from "next/link";
import { humanize, statusToneClass } from "@/components/governance/governance-panels";
import { Panel } from "@/components/ui/page";

type TraceNode = {
  label: string;
  href?: string;
  detail?: string | null;
  status?: string | null;
};

export function TraceabilityPanel({
  initiativeId,
  demand,
  preStudy,
  poc,
  pilot,
  project,
  decisions,
}: {
  initiativeId: string;
  demand?: { problemOpportunity?: string | null } | null;
  preStudy?: { id: string } | null;
  poc?: { id: string; status: string; title?: string } | null;
  pilot?: { id: string; status: string } | null;
  project?: { id: string; referenceKey: string; name: string; status: string } | null;
  decisions?: {
    id: string;
    outcome: string;
    gate?: { gateType: string } | null;
  }[];
}) {
  const nodes: TraceNode[] = [
    {
      label: "Demand",
      href: `/initiatives/${initiativeId}/demand`,
      detail: demand?.problemOpportunity
        ? demand.problemOpportunity.slice(0, 120)
        : "Captured",
    },
    {
      label: "Requirements",
      href: `/initiatives/${initiativeId}/requirements`,
    },
    {
      label: "Pre-study",
      href: `/initiatives/${initiativeId}/pre-study`,
      detail: preStudy ? "Present" : "Not started",
    },
    {
      label: "PoC",
      href: `/initiatives/${initiativeId}/poc`,
      status: poc?.status,
      detail: poc?.title ?? (poc ? humanize(poc.status) : "Not created"),
    },
    {
      label: "Pilot",
      href: `/initiatives/${initiativeId}/pilot`,
      status: pilot?.status,
      detail: pilot ? humanize(pilot.status) : "Not created",
    },
    {
      label: "Project",
      href: `/initiatives/${initiativeId}/project`,
      status: project?.status,
      detail: project
        ? `${project.referenceKey} · ${project.name}`
        : "Not converted",
    },
  ];

  const gateDecisions = (decisions ?? []).filter((d) => d.gate?.gateType);

  return (
    <Panel>
      <h2 className="mb-2 font-medium">Traceability</h2>
      <p className="mb-3 text-xs text-[var(--muted)]">
        Demand → Requirements → Pre-study → PoC → Pilot → Project
      </p>
      <ol className="space-y-2 text-sm">
        {nodes.map((node, index) => (
          <li key={node.label} className="flex items-start gap-2">
            <span className="mt-0.5 w-5 shrink-0 text-[var(--muted)]">
              {index + 1}.
            </span>
            <div className="min-w-0 flex-1">
              {node.href ? (
                <Link href={node.href} className="font-medium text-[var(--accent)]">
                  {node.label}
                </Link>
              ) : (
                <span className="font-medium">{node.label}</span>
              )}
              {node.status ? (
                <span className={`ml-2 text-xs ${statusToneClass(node.status)}`}>
                  {humanize(node.status)}
                </span>
              ) : null}
              {node.detail ? (
                <p className="truncate text-xs text-[var(--muted)]">{node.detail}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {gateDecisions.length > 0 ? (
        <div className="mt-4 border-t border-[var(--line)] pt-3">
          <h3 className="mb-2 text-sm font-medium">Governing decisions</h3>
          <ul className="space-y-1 text-sm">
            {gateDecisions.map((d) => (
              <li key={d.id} className="flex justify-between gap-2">
                <span className="text-[var(--muted)]">
                  {humanize(d.gate?.gateType ?? "GATE")}
                </span>
                <span className={statusToneClass(d.outcome)}>
                  {humanize(d.outcome)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}
