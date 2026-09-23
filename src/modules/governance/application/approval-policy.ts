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

export const DEFAULT_PILOT_GATE_APPROVAL_REQUIREMENTS: ApprovalRequirementSeed[] =
  [
    {
      gateType: "PILOT_GATE",
      authorityKey: "business",
      requiredPermission: PERMISSIONS.APPROVAL_AUTHORITY_BUSINESS,
      label: "Business authority",
      required: true,
      sortOrder: 10,
    },
    {
      gateType: "PILOT_GATE",
      authorityKey: "architecture",
      requiredPermission: PERMISSIONS.APPROVAL_AUTHORITY_ARCHITECTURE,
      label: "Architecture authority",
      required: true,
      sortOrder: 20,
    },
    {
      gateType: "PILOT_GATE",
      authorityKey: "security",
      requiredPermission: PERMISSIONS.APPROVAL_AUTHORITY_SECURITY,
      label: "Security authority",
      required: true,
      sortOrder: 30,
    },
  ];

/**
 * Ensure default templates exist for all gates.
 * Does not overwrite admin-versioned rows: only creates missing authority keys
 * at policyVersion 1 when no non-superseded row exists for that key.
 */
export async function ensureDefaultApprovalTemplates(
  db: PrismaClient,
): Promise<void> {
  const seeds = [
    ...DEFAULT_PRE_STUDY_APPROVAL_REQUIREMENTS,
    ...DEFAULT_POC_APPROVAL_REQUIREMENTS,
    ...DEFAULT_PILOT_GATE_APPROVAL_REQUIREMENTS,
  ];
  for (const seed of seeds) {
    const existing = await db.approvalRequirementTemplate.findFirst({
      where: {
        gateType: seed.gateType,
        authorityKey: seed.authorityKey,
        supersededAt: null,
      },
      orderBy: { policyVersion: "desc" },
    });
    if (existing) {
      // Keep admin edits; only re-activate if somehow inactive without supersession.
      if (!existing.active) {
        await db.approvalRequirementTemplate.update({
          where: { id: existing.id },
          data: { active: true },
        });
      }
      continue;
    }
    await db.approvalRequirementTemplate.create({
      data: {
        gateType: seed.gateType,
        authorityKey: seed.authorityKey,
        requiredPermission: seed.requiredPermission,
        label: seed.label,
        required: seed.required,
        sortOrder: seed.sortOrder,
        conditionNote: seed.conditionNote ?? null,
        active: true,
        policyVersion: 1,
      },
    });
  }
}

export async function getActiveTemplates(
  db: PrismaClient,
  gateType: GateType,
) {
  return db.approvalRequirementTemplate.findMany({
    where: { gateType, active: true, supersededAt: null },
    orderBy: { sortOrder: "asc" },
  });
}

/** Highest active policyVersion for a gate (used when recording submissions). */
export async function getActivePolicyVersion(
  db: PrismaClient,
  gateType: GateType,
): Promise<number> {
  const templates = await getActiveTemplates(db, gateType);
  if (templates.length === 0) return 1;
  return Math.max(...templates.map((t) => t.policyVersion));
}
