import { notFound } from "next/navigation";
import { Breadcrumbs, PageHeader } from "@/components/ui/page";
import { HelpArticle } from "@/components/help/help-article";
import { homeCrumb } from "@/modules/navigation/breadcrumbs";
import {
  getHelpDoc,
  helpDocSlugs,
  listHelpDocs,
} from "@/modules/help/load-help-docs";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return helpDocSlugs().map((slug) => ({ slug }));
}

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = await getHelpDoc(slug);
  if (!doc) notFound();
  const siblings = listHelpDocs();

  return (
    <div>
      <Breadcrumbs
        items={[
          homeCrumb(),
          { label: "Help", href: "/help" },
          { label: doc.title },
        ]}
      />
      <PageHeader title={doc.title} description={doc.summary} />
      <HelpArticle doc={doc} siblings={siblings} />
    </div>
  );
}
