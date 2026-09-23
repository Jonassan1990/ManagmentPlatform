import Link from "next/link";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 text-sm text-[var(--muted)]">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-1">
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href ? (
              <Link href={item.href} className="hover:text-[var(--ink)]">
                {item.label}
              </Link>
            ) : (
              <span className="text-[var(--ink)]">{item.label}</span>
            )}
          </li>
        ))}
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
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 ${className}`}
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

export function Alert({
  tone = "danger",
  children,
}: {
  tone?: "danger" | "warning" | "ok";
  children: React.ReactNode;
}) {
  const color =
    tone === "ok"
      ? "var(--ok)"
      : tone === "warning"
        ? "var(--warning)"
        : "var(--danger)";
  return (
    <div
      role="alert"
      className="rounded-md border px-3 py-2 text-sm"
      style={{ borderColor: color, color }}
    >
      {children}
    </div>
  );
}
