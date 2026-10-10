import Link from "next/link";

/** Rich alert with dismiss / live regions — client component. */
export { Alert, InlineFeedback } from "@/components/ui/alert";
export type { AlertProps, AlertTone, LegacyAlertTone } from "@/components/ui/alert";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const collapseMiddle = items.length > 3;
  return (
    <nav aria-label="Breadcrumb" className="mb-3 text-sm text-[var(--muted)]">
      <ol className="flex max-w-full flex-wrap items-center gap-1 sm:gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isCurrent = isLast || !item.href;
          const isMiddle =
            collapseMiddle && index > 0 && index < items.length - 2;
          const nodes = [];
          if (index === 1 && collapseMiddle) {
            nodes.push(
              <li
                key="ellipsis"
                aria-hidden="true"
                className="flex items-center gap-1 sm:hidden"
              >
                <span className="text-[var(--muted)]">/</span>
                <span title="Ancestor pages omitted on small screens">…</span>
              </li>,
            );
          }
          nodes.push(
            <li
              key={`${item.label}-${index}`}
              className={`min-w-0 max-w-[min(100%,14rem)] items-center gap-1 sm:max-w-xs ${
                isMiddle ? "hidden sm:flex" : "flex"
              }`}
            >
              {index > 0 ? (
                <span aria-hidden="true" className="shrink-0 text-[var(--muted)]">
                  /
                </span>
              ) : null}
              {item.href && !isCurrent ? (
                <Link
                  href={item.href}
                  className="truncate hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                  title={item.label}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className="truncate font-medium text-[var(--ink)]"
                  title={item.label}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>,
          );
          return nodes;
        })}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--ink)]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-[var(--muted)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  children,
  className = "",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={`rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] ${className}`}
      {...rest}
    >
      {children}
    </section>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Panel className="text-center">
      <h2 className="font-[family-name:var(--font-display)] text-xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-[var(--muted)]">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </Panel>
  );
}
