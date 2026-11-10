import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { compileMDX } from "next-mdx-remote/rsc";
import type { ReactElement } from "react";
import { helpMdxComponents } from "@/components/help/mdx-components";

const HELP_DIR = path.join(process.cwd(), "docs/help");

export type HelpDocMeta = {
  slug: string;
  title: string;
  summary: string;
  audience: string;
  order: number;
};

export type HelpDoc = HelpDocMeta & {
  content: ReactElement;
};

function isHelpMdx(fileName: string): boolean {
  return fileName.endsWith(".mdx");
}

function readMeta(fileName: string): HelpDocMeta | null {
  const slug = fileName.replace(/\.mdx$/, "");
  const raw = fs.readFileSync(path.join(HELP_DIR, fileName), "utf8");
  const { data } = matter(raw);
  const title = typeof data.title === "string" ? data.title : slug;
  const summary = typeof data.summary === "string" ? data.summary : "";
  const audience = typeof data.audience === "string" ? data.audience : "Everyone";
  const order = typeof data.order === "number" ? data.order : 99;
  return { slug, title, summary, audience, order };
}

export function listHelpDocs(): HelpDocMeta[] {
  if (!fs.existsSync(HELP_DIR)) return [];
  return fs
    .readdirSync(HELP_DIR)
    .filter(isHelpMdx)
    .map(readMeta)
    .filter((row): row is HelpDocMeta => Boolean(row))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

export async function getHelpDoc(slug: string): Promise<HelpDoc | null> {
  const filePath = path.join(HELP_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf8");
  const { content, data } = matter(raw);
  const { content: compiled } = await compileMDX({
    source: content,
    components: helpMdxComponents,
    options: { parseFrontmatter: false },
  });
  return {
    slug,
    title: typeof data.title === "string" ? data.title : slug,
    summary: typeof data.summary === "string" ? data.summary : "",
    audience: typeof data.audience === "string" ? data.audience : "Everyone",
    order: typeof data.order === "number" ? data.order : 99,
    content: compiled,
  };
}

export function helpDocSlugs(): string[] {
  return listHelpDocs().map((doc) => doc.slug);
}
