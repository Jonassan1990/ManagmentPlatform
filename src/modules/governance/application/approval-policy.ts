import type { GateType, PrismaClient } from "@prisma/client";
import { PERMISSIONS } from "@/modules/shared/permissions";

export type ApprovalRequirementSeed = {
  gateType: GateType;
  authorityKey: string;
  requiredPermission: string;
  label: string;
  required: boolean;
  sortOrder: number;
  conditionNote?: string | null;
};

/**
 * Default Pre-study gate approval slots.
 * These are bootstrap policy seeds — not permanent hardcoded org rules.
 * Organizations may later deactivate/extend via ApprovalRequirementTemplate rows.
 */
export const DEFAULT_PRE_STUDY_APPROVAL_REQUIREMENTS: ApprovalRequirementSeed[] =
  [
    {
      gateType: "PRE_STUDY_GATE",
      authorityKey: "business",
      requiredPermission: PERMISSIONS.APPROVAL_AUTHORITY_BUSINESS,
      label: "Business authority",
      required: true,
      sortOrder: 10,
    },
    {
      gateType: "PRE_STUDY_GATE",
      authorityKey: "architecture",
      requiredPermission: PERMISSIONS.APPROVAL_AUTHORITY_ARCHITECTURE,
      label: "Architecture authority",
      required: true,
      sortOrder: 20,
    },
    {
      gateType: "PRE_STUDY_GATE",
      authorityKey: "security",
      requiredPermission: PERMISSIONS.APPROVAL_AUTHORITY_SECURITY,
      label: "Security authority",
      required: true,
      sortOrder: 30,
    },
  ];

export const DEFAULT_POC_APPROVAL_REQUIREMENTS: ApprovalRequirementSeed[] = [
  {
    gateType: "POC_GATE",
    authorityKey: "business",
    requiredPermission: PERMISSIONS.APPROVAL_AUTHORITY_BUSINESS,
    label: "Business authority",
    required: true,
    sortOrder: 10,
  },
  {
    gateType: "POC_GATE",
    authorityKey: "architecture",
    requiredPermission: PERMISSIONS.APPROVAL_AUTHORITY_ARCHITECTURE,
    label: "Architecture authority",
    required: true,
    sortOrder: 20,
  },
  {
    gateType: "POC_GATE",
    authorityKey: "security",
    requiredPermission: PERMISSIONS.APPROVAL_AUTHORITY_SECURITY,
    label: "Security authority",
    required: true,
    sortOrder: 30,
  },
];

export async function ensureDefaultApprovalTemplates(
  db: PrismaClient,
): Promise<void> {
  const seeds = [
    ...DEFAULT_PRE_STUDY_APPROVAL_REQUIREMENTS,
    ...DEFAULT_POC_APPROVAL_REQUIREMENTS,
  ];
  for (const seed of seeds) {
    await db.approvalRequirementTemplate.upsert({
      where: {
        gateType_authorityKey: {
          gateType: seed.gateType,
          authorityKey: seed.authorityKey,
        },
      },
      create: {
        gateType: seed.gateType,
        authorityKey: seed.authorityKey,
        requiredPermission: seed.requiredPermission,
        label: seed.label,
        required: seed.required,
        sortOrder: seed.sortOrder,
        conditionNote: seed.conditionNote ?? null,
        active: true,
      },
      update: {
        requiredPermission: seed.requiredPermission,
        label: seed.label,
        required: seed.required,
        sortOrder: seed.sortOrder,
        conditionNote: seed.conditionNote ?? null,
        active: true,
      },
    });
  }
}

export async function getActiveTemplates(
  db: PrismaClient,
  gateType: GateType,
) {
  return db.approvalRequirementTemplate.findMany({
    where: { gateType, active: true },
    orderBy: { sortOrder: "asc" },
  });
}
