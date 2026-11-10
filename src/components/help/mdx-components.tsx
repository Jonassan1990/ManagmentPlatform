import Link from "next/link";
import type { MDXComponents } from "mdx/types";

export const helpMdxComponents: MDXComponents = {
  h1: (props) => (
    <h1
      className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]"
      {...props}
    />
  ),
  h2: (props) => (
    <h2
      className="mt-8 font-[family-name:var(--font-display)] text-xl text-[var(--ink)]"
      {...props}
    />
  ),
  h3: (props) => (
    <h3 className="mt-6 text-base font-semibold text-[var(--ink)]" {...props} />
  ),
  p: (props) => (
    <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]" {...props} />
  ),
  ul: (props) => (
    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]" {...props} />
  ),
  ol: (props) => (
    <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-[var(--muted)]" {...props} />
  ),
  li: (props) => <li className="leading-relaxed" {...props} />,
  a: ({ href = "#", children, ...rest }) => {
    const className =
      "font-medium text-[var(--color-accent)] underline underline-offset-2";
    if (href.startsWith("/")) {
      return (
        <Link href={href} className={className}>
          {children}
        </Link>
      );
    }
    return (
      <a href={href} className={className} {...rest}>
        {children}
      </a>
    );
  },
  strong: (props) => (
    <strong className="font-semibold text-[var(--ink)]" {...props} />
  ),
  code: (props) => (
    <code
      className="rounded bg-[var(--surface-muted,#f3f5f7)] px-1 py-0.5 text-[0.85em] text-[var(--ink)]"
      {...props}
    />
  ),
  pre: (props) => (
    <pre
      className="mt-4 overflow-x-auto rounded-md border border-[var(--line)] bg-[#0b1220] p-4 text-xs text-white"
      {...props}
    />
  ),
  table: (props) => (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[28rem] text-left text-sm" {...props} />
    </div>
  ),
  th: (props) => (
    <th
      className="border-b border-[var(--line)] py-2 pr-3 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]"
      {...props}
    />
  ),
  td: (props) => (
    <td className="border-b border-[var(--line)] py-2 pr-3 align-top text-[var(--ink)]" {...props} />
  ),
};
