import Link from "next/link";

export const ADMIN_CONFIG_TABS = [
  { id: "confirm", label: "Confirm roster" },
  { id: "hierarchy", label: "Hierarchy" },
  { id: "people", label: "People & departments" },
  { id: "roles", label: "Roles & users" },
] as const;

export type AdminConfigTabId = (typeof ADMIN_CONFIG_TABS)[number]["id"];

export function parseAdminConfigTab(raw: string | undefined): AdminConfigTabId {
  const match = ADMIN_CONFIG_TABS.find((tab) => tab.id === raw);
  return match?.id ?? "confirm";
}

export function AdminConfigTabs({
  organizationId,
  active,
}: {
  organizationId: string;
  active: AdminConfigTabId;
}) {
  return (
    <nav
      aria-label="Admin config sections"
      className="mb-6 flex flex-wrap gap-2 border-b border-[var(--line)] pb-3"
    >
      {ADMIN_CONFIG_TABS.map((tab) => {
        const href = `/organization/${organizationId}/admin?tab=${tab.id}`;
        const isActive = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={href}
            className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium ${
              isActive
                ? "bg-[var(--ink)] text-white"
                : "border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--surface)]"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
