import Link from "next/link";
import { getHomeDashboardAction } from "@/app/actions/home";
import { HomeDashboardView } from "@/components/home/home-dashboard-view";
import { Breadcrumbs, EmptyState, Panel } from "@/components/ui/page";
import { buttonClassName } from "@/components/ui/button";

export const dynamic = "force-dynamic";

/**
 * M5B-B — Role-aware Home. Single aggregation via getHomeDashboardAction.
 */
export default async function HomePage() {
  const result = await getHomeDashboardAction({});

  if (!result.ok) {
    const code = result.error.code;
    const isAuth =
      code === "UNAUTHORIZED" ||
      result.error.message.toLowerCase().includes("principal");

    return (
      <div>
        <Breadcrumbs items={[{ label: "Home" }]} />
        {isAuth ? (
          <EmptyState
            title="Sign in to open your workspace"
            description="Use your organization sign-in to see attention items, owned work, and Quick Start actions."
            action={
              <Link
                href="/login"
                className={buttonClassName({ variant: "primary" })}
              >
                Sign in
              </Link>
            }
          />
        ) : (
          <EmptyState
            title="Home could not be loaded"
            description="Try again in a moment. If this continues, contact your platform administrator."
          />
        )}
      </div>
    );
  }

  const dash = result.data;

  if (dash.userContext.availability.state === "no_organization") {
    return (
      <div>
        <Breadcrumbs items={[{ label: "Home" }]} />
        <EmptyState
          title="Set up your organization"
          description="Create the first organization before capturing initiatives, planning PIs, or reviewing capacity."
          action={
            <Link
              href="/organization/setup"
              className={buttonClassName({ variant: "primary" })}
            >
              Set up organization
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: "Home" }]} />
      <HomeDashboardView dashboard={dash} />
      <Panel className="mt-8">
        <p className="text-xs text-[var(--muted)]">
          Metrics and lists come from authorized live records. Unavailable
          sections are never shown as zero. Updated{" "}
          <time dateTime={dash.asOf}>
            {new Date(dash.asOf).toLocaleString()}
          </time>
          .
        </p>
      </Panel>
    </div>
  );
}
