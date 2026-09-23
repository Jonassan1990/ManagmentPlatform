export type Principal = {
  id: string;
  displayName: string | null;
  /** Display-only; never used as an identity key. */
  email?: string | null;
  source: "oidc" | "dev" | "test";
};

export type AuthScope =
  | { type: "PLATFORM" }
  | { type: "ORGANIZATION"; organizationId: string }
  | { type: "SECTION"; organizationId: string; sectionId: string }
  | { type: "DEPARTMENT"; organizationId: string; departmentId: string }
  | { type: "TEAM"; organizationId: string; teamId: string };
