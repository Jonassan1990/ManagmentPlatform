"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { SignOutButton } from "./sign-out-button";

const navItems = [
  { href: "/", label: "Overview", available: true },
  { href: "/organization", label: "Organization", available: true },
  { href: "/initiatives", label: "Initiatives", available: true },
  { href: "/approvals", label: "Approvals", available: true },
  { href: "/decisions", label: "Decisions", available: true },
  { href: "/pi", label: "PI Planning", available: true },
];

export type ShellPrincipal = {
  displayName: string | null;
  email: string | null;
  source: string;
  hasAccess: boolean;
};

export function AppShell({
  children,
  principal,
}: {
  children: React.ReactNode;
  principal?: ShellPrincipal | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const governancePolicyHref = useMemo(() => {
    const match = pathname.match(/^\/organization\/([^/]+)/);
    return match ? `/organization/${match[1]}/governance-policy` : null;
  }, [pathname]);

  const label =
    principal?.displayName ||
    principal?.email ||
    (principal ? "Signed in" : null);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-[var(--sidebar)] text-[var(--sidebar-ink)] transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center border-b border-white/10 px-5">
          <div>
            <p className="font-[family-name:var(--font-display)] text-lg tracking-tight text-white">
              Management Platform
            </p>
            <p className="text-xs text-white/60">Phase 6 identity</p>
          </div>
        </div>
        <nav className="space-y-1 p-3" aria-label="Primary">
          {navItems.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`block rounded-md px-3 py-2 text-sm ${
                  active
                    ? "bg-[var(--sidebar-active)] text-white"
                    : "hover:bg-white/5"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <Link
            href={governancePolicyHref ?? "/organization"}
            onClick={() => setOpen(false)}
            className={`block rounded-md px-3 py-2 text-sm text-white/80 ${
              pathname.includes("/governance-policy")
                ? "bg-[var(--sidebar-active)] text-white"
                : "hover:bg-white/5"
            }`}
          >
            Governance policy
          </Link>
        </nav>
      </aside>

      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--line)] bg-[var(--surface)] px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
            >
              Menu
            </button>
            <p className="text-sm text-[var(--muted)]">
              Structured management foundation
            </p>
          </div>
          <div className="flex items-center gap-3">
            {label ? (
              <>
                <div className="hidden text-right sm:block">
                  <p className="text-sm text-[var(--ink)]">{label}</p>
                  {principal?.email && principal.displayName ? (
                    <p className="text-xs text-[var(--muted)]">
                      {principal.email}
                    </p>
                  ) : null}
                </div>
                {principal?.source === "oidc" ? <SignOutButton /> : null}
                {principal?.source === "dev" ? (
                  <span className="rounded-md border border-[var(--line)] px-2 py-1 text-xs text-[var(--muted)]">
                    DEV
                  </span>
                ) : null}
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm hover:bg-black/5"
              >
                Sign in
              </Link>
            )}
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
