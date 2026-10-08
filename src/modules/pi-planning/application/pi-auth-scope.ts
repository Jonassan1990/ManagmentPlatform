import type { AuthScope } from "@/modules/identity-access/domain/types";

/** Prefer SECTION scope when PI is section-bound; else ORGANIZATION. */
export function piAuthScope(
  organizationId: string,
  sectionId: string | null | undefined,
): AuthScope {
  if (sectionId) {
    return {
      type: "SECTION",
      organizationId,
      sectionId,
    };
  }
  return { type: "ORGANIZATION", organizationId };
}
