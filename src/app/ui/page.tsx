import { Breadcrumbs, PageHeader } from "@/components/ui/page";
import { UiShowcaseClient } from "@/app/ui/showcase-client";

/**
 * Design-system component showcase (M4B-B).
 * Demonstration data only — not a production business workflow.
 */
export default function UiShowcasePage() {
  return (
    <div className="mx-auto max-w-5xl px-[var(--page-padding-x)] py-[var(--page-padding-y)] md:px-[var(--page-padding-x-md)]">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "UI components" },
        ]}
      />
      <PageHeader
        title="UI component showcase"
        description="M4B-B reusable primitives built on design tokens. Demonstration controls only — not business functionality."
      />
      <UiShowcaseClient />
    </div>
  );
}
