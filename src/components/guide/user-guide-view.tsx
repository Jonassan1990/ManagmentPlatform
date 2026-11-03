import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { Panel } from "@/components/ui/page";
import {
  USER_GUIDE_INTRO,
  USER_GUIDE_SECTIONS,
} from "@/modules/guide/user-guide";

export function UserGuideView() {
  return (
    <div className="space-y-6">
      <Panel className="border-[var(--accent)]/30 bg-[linear-gradient(135deg,#f7fbfb_0%,#ffffff_55%)]">
        <p className="ds-eyebrow text-[10px]">Help</p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          {USER_GUIDE_INTRO.tagline}
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
          {USER_GUIDE_INTRO.audience}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/" className={buttonClassName({ variant: "primary" })}>
            Open Home
          </Link>
          <Link
            href="/organization"
            className={buttonClassName({ variant: "secondary" })}
          >
            Organization
          </Link>
          <Link
            href="/initiatives"
            className={buttonClassName({ variant: "secondary" })}
          >
            Initiatives
          </Link>
        </div>
      </Panel>

      <nav aria-label="Guide sections">
        <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {USER_GUIDE_SECTIONS.map((section, index) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="block rounded-xl border border-[var(--line)] bg-white p-4 transition hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
              >
                <p className="text-xs font-semibold text-[var(--accent)]">
                  Step {index + 1}
                </p>
                <p className="mt-1 font-medium text-[var(--ink)]">
                  {section.title.replace(/^\d+\.\s*/, "")}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {section.summary}
                </p>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {USER_GUIDE_SECTIONS.map((section) => (
        <section
          key={section.id}
          id={section.id}
          className="scroll-mt-24 space-y-3"
          aria-labelledby={`${section.id}-title`}
        >
          <div>
            <h2
              id={`${section.id}-title`}
              className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]"
            >
              {section.title}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{section.summary}</p>
          </div>
          <ol className="grid gap-3 lg:grid-cols-2">
            {section.steps.map((step, index) => (
              <li key={step.id}>
                <Panel className="h-full">
                  <p className="text-xs font-semibold text-[var(--muted)]">
                    {index + 1}. {step.title}
                  </p>
                  <p className="mt-2 text-sm text-[var(--ink)]">{step.body}</p>
                  {step.href && step.hrefLabel ? (
                    <Link
                      href={step.href}
                      className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--accent)] hover:underline"
                    >
                      {step.hrefLabel}
                    </Link>
                  ) : null}
                </Panel>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
