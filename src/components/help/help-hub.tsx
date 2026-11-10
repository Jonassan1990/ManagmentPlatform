import Link from "next/link";
import { Panel } from "@/components/ui/page";
import { buttonClassName } from "@/components/ui/button";
import type { HelpDocMeta } from "@/modules/help/load-help-docs";

export function HelpHub({ docs }: { docs: HelpDocMeta[] }) {
  return (
    <div className="space-y-6">
      <Panel className="border-[var(--accent)]/30 bg-[linear-gradient(135deg,#f7fbfb_0%,#ffffff_55%)]">
        <p className="ds-eyebrow text-[10px]">Help</p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          Design, development, and how to use the platform
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
          In-app documentation written in MDX. Start with the user guide, then
          open design or development when you need deeper context.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/help/user-guide"
            className={buttonClassName({ variant: "primary" })}
          >
            User guide
          </Link>
          <Link href="/approvals" className={buttonClassName({ variant: "secondary" })}>
            Approvals
          </Link>
          <Link href="/" className={buttonClassName({ variant: "secondary" })}>
            Home
          </Link>
        </div>
      </Panel>

      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {docs.map((doc) => (
          <li key={doc.slug}>
            <Link
              href={`/help/${doc.slug}`}
              className="block h-full rounded-xl border border-[var(--line)] bg-white p-4 transition hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                {doc.audience}
              </p>
              <p className="mt-1 font-semibold text-[var(--ink)]">{doc.title}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{doc.summary}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
