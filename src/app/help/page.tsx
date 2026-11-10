import { Breadcrumbs, PageHeader } from "@/components/ui/page";
import { HelpHub } from "@/components/help/help-hub";
import { homeCrumb } from "@/modules/navigation/breadcrumbs";
import { listHelpDocs } from "@/modules/help/load-help-docs";

export const dynamic = "force-dynamic";

export default function HelpPage() {
  const docs = listHelpDocs();
  return (
    <div>
      <Breadcrumbs items={[homeCrumb(), { label: "Help" }]} />
      <PageHeader
        title="Help"
        description="User guide, design notes, and development documentation."
      />
      <HelpHub docs={docs} />
    </div>
  );
}
