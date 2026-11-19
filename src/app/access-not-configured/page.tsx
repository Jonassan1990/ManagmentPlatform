import Link from "next/link";
import { redirect } from "next/navigation";
import { ExitViewAsButton } from "@/components/demo/exit-view-as-button";
import { Breadcrumbs, EmptyState, PageHeader } from "@/components/ui/page";
import { createServices } from "@/server/container";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { buttonClassName } from "@/components/ui/button";
import { readDemoPersonaCookie } from "@/modules/demo/demo-persona-runtime";
import { isImpersonationKey } from "@/modules/demo/persona-keys";

export const dynamic = "force-dynamic";

export default async function AccessNotConfiguredPage() {
  const { authz, identity } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) {
    redirect("/login");
  }

  const viewingAsKey = await readDemoPersonaCookie();
  const viewingAs = isImpersonationKey(viewingAsKey);

  if (!viewingAs) {
    const hasAccess = await identity.hasAnyAccess(principal.id);
    if (hasAccess) {
      redirect("/");
    }
  }

  const bootstrapConsumed = viewingAs
    ? true
    : await identity.isBootstrapConsumed();

  return (
    <div className="mx-auto max-w-lg py-10">
      <Breadcrumbs items={[{ label: "Access" }]} />
      <PageHeader
        title={viewingAs ? "This person is not configured" : "Access not configured"}
        description={
          viewingAs
            ? `${principal.displayName ?? "This person"} has no role bindings yet, so their dashboard is empty.`
            : "You are signed in, but no role bindings have been granted yet."
        }
      />
      <EmptyState
        title={viewingAs ? "View as needs roles" : "Least-privilege identity"}
        description={
          viewingAs
            ? "Exit View as, open Admin config, and run Prepare org, people & roles. Then try View as again."
            : bootstrapConsumed
              ? "Platform bootstrap has already been used. Ask an administrator to grant you a role binding, or open Admin if you are the owner."
              : "If you are the first operator, complete the one-time bootstrap with the setup token, or open Admin config as the owner."
        }
        action={
          <div className="flex flex-wrap items-center justify-center gap-3">
            {viewingAs ? (
              <ExitViewAsButton />
            ) : (
              <Link
                href="/admin"
                className={buttonClassName({ variant: "primary" })}
              >
                Open Admin config
              </Link>
            )}
            {!bootstrapConsumed && !viewingAs ? (
              <Link
                href="/setup/bootstrap"
                className={buttonClassName({ variant: "secondary" })}
              >
                Run bootstrap setup
              </Link>
            ) : null}
            {!viewingAs ? <SignOutButton /> : null}
          </div>
        }
      />
    </div>
  );
}
