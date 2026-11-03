import { Breadcrumbs, PageHeader } from "@/components/ui/page";
import { UserGuideView } from "@/components/guide/user-guide-view";
import { USER_GUIDE_INTRO } from "@/modules/guide/user-guide";
import { homeCrumb } from "@/modules/navigation/breadcrumbs";

export const dynamic = "force-dynamic";

export default function UserGuidePage() {
  return (
    <div>
      <Breadcrumbs
        items={[homeCrumb(), { label: USER_GUIDE_INTRO.title }]}
      />
      <PageHeader
        title={USER_GUIDE_INTRO.title}
        description="One guide for setup, daily work, planning, and governance."
      />
      <UserGuideView />
    </div>
  );
}
