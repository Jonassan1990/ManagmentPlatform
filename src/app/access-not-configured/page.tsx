import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumbs, EmptyState, PageHeader } from "@/components/ui/page";
import { createServices } from "@/server/container";
import { SignOutButton } from "@/components/shell/sign-out-button";

export const dynamic = "force-dynamic";

export default async function AccessNotConfiguredPage() {
  const { authz, identity } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) {
    redirect("/login");
  }

  const hasAccess = await identity.hasAnyAccess(principal.id);
  if (hasAccess) {
    redirect("/");
  }

  const bootstrapConsumed = await identity.isBootstrapConsumed();

  return (
    <div className="mx-auto max-w-lg py-10">
      <Breadcrumbs items={[{ label: "Access" }]} />
      <PageHeader
        title="Access not configured"
        description="You are signed in, but no role bindings have been granted yet."
      />
      <EmptyState
        title="Least-privilege identity"
        description={
          bootstrapConsumed
            ? "Platform bootstrap has already been used. Ask an administrator to grant you a role binding."
            : "If you are the first operator, complete the one-time bootstrap with the setup token."
        }
        action={
          <div className="flex flex-wrap items-center justify-center gap-3">
            {!bootstrapConsumed ? (
              <Link
                href="/setup/bootstrap"
                className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Run bootstrap setup
              </Link>
            ) : null}
            <SignOutButton />
          </div>
        }
      />
    </div>
  );
}
