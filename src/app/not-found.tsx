import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        404
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-[var(--ink)]">
        Page not found
      </h1>
      <p className="mt-3 text-[var(--muted)]">
        This link is missing, was removed, or you do not have access. Use the
        sidebar or go home and try again.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/" className={buttonClassName({ variant: "primary" })}>
          Home
        </Link>
        <Link
          href="/organization"
          className={buttonClassName({ variant: "secondary" })}
        >
          Organization
        </Link>
        <Link
          href="/vacation"
          className={buttonClassName({ variant: "secondary" })}
        >
          Vacation
        </Link>
        <Link
          href="/guide"
          className={buttonClassName({ variant: "secondary" })}
        >
          User guide
        </Link>
      </div>
    </div>
  );
}
