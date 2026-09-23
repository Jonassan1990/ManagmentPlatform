export const PERMISSIONS = {
  ORG_STRUCTURE_READ: "org.structure.read",
  ORG_STRUCTURE_MANAGE: "org.structure.manage",
  PLATFORM_BOOTSTRAP: "platform.bootstrap",
  AUDIT_READ: "audit.read",
  ROLE_MANAGE: "role.manage",
} as const;

export type Permission =
  (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_KEYS = {
  PLATFORM_BOOTSTRAP_ADMIN: "platform.bootstrap_admin",
  ORGANIZATION_ADMIN: "organization.admin",
} as const;
