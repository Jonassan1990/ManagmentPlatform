import { notFound, redirect } from "next/navigation";
import { CreateDocumentForm } from "@/components/initiative/initiative-forms";
import {
  InitiativeTabs,
  LifecycleRail,
} from "@/components/initiative/workspace";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ initiativeId: string }>;
}) {
  const { initiativeId } = await params;
  const { authz, initiative } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");
  let workspace;
  try {
    workspace = await initiative.getInitiativeWorkspace(principal, initiativeId);
  } catch {
    notFound();
  }
  const item = workspace.initiative;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Initiatives", href: "/initiatives" },
          { label: item.referenceKey, href: `/initiatives/${item.id}` },
          { label: "Documents" },
        ]}
      />
      <PageHeader
        title={item.title}
        description={`${item.referenceKey} · Documents`}
      />
      <div className="mb-5">
        <LifecycleRail current={item.currentStage} />
      </div>
      <InitiativeTabs initiativeId={item.id} active="documents" />
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel>
          <h2 className="mb-3 font-medium">Documentation hub (metadata)</h2>
          <p className="mb-3 text-sm text-[var(--muted)]">
            Binary upload is deferred. Versions store metadata and optional future
            storage pointers — not file bytes in PostgreSQL.
          </p>
          {item.documents.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No documents registered.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {item.documents.map((doc) => (
                <li key={doc.id}>
                  <p className="font-medium">{doc.title}</p>
                  <p className="text-[var(--muted)]">
                    {doc.category}
                    {doc.stage ? ` · ${doc.stage}` : ""}
                    {doc.versions[0]
                      ? ` · v${doc.versions[0].versionLabel} (${doc.versions[0].lifecycleStatus})`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel>
          <CreateDocumentForm initiativeId={item.id} />
        </Panel>
      </div>
    </div>
  );
}
