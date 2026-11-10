import Link from "next/link";
import { Panel } from "@/components/ui/page";
import { buttonClassName } from "@/components/ui/button";
import type { HelpDoc, HelpDocMeta } from "@/modules/help/load-help-docs";

export function HelpArticle({
  doc,
  siblings,
}: {
  doc: HelpDoc;
  siblings: HelpDocMeta[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_14rem]">
      <Panel>
        <p className="ds-eyebrow text-[10px]">{doc.audience}</p>
        <div className="mp-help-prose mt-2">{doc.content}</div>
      </Panel>
      <aside className="space-y-3">
        <Panel>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Help
          </p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/help" className="text-sm text-[var(--color-accent)] underline">
                All articles
              </Link>
            </li>
            {siblings.map((row) => (
              <li key={row.slug}>
                <Link
                  href={`/help/${row.slug}`}
                  className={`text-sm ${
                    row.slug === doc.slug
                      ? "font-semibold text-[var(--ink)]"
                      : "text-[var(--muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  {row.title}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/approvals"
            className={`mt-4 inline-flex ${buttonClassName({ variant: "secondary" })}`}
          >
            Open Approvals
          </Link>
        </Panel>
      </aside>
    </div>
  );
}
