import { redirect } from "next/navigation";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
import { createServices } from "@/server/container";
import { getBootstrapSetupToken } from "@/server/env";
import { BootstrapForm } from "./bootstrap-form";

export const dynamic = "force-dynamic";

export default async function BootstrapSetupPage() {
  const { authz, identity } = createServices();
  const principal = await authz.requirePrincipal();

  const consumed = await identity.isBootstrapConsumed();
  if (consumed) {
    redirect("/access-not-configured");
  }

  const tokenConfigured = Boolean(getBootstrapSetupToken());

  return (
    <div className="mx-auto max-w-lg py-10">
      <Breadcrumbs
        items={[
          { label: "Access", href: "/access-not-configured" },
          { label: "Bootstrap" },
        ]}
      />
      <PageHeader
        title="Platform bootstrap"
        description="Submit the one-time BOOTSTRAP_SETUP_TOKEN to receive platform bootstrap authority. This is not first-login-is-admin."
      />
      <Panel>
        {!tokenConfigured ? (
          <p className="text-sm text-[var(--muted)]">
            Bootstrap token is not configured on the server. An operator must set{" "}
            <code className="text-xs">BOOTSTRAP_SETUP_TOKEN</code> (min 16
            characters) before this form can succeed.
          </p>
        ) : (
          <BootstrapForm
            principalLabel={
              principal.displayName ?? principal.email ?? principal.id
            }
          />
        )}
      </Panel>
    </div>
  );
}
