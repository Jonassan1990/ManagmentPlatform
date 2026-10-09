-- M3D-C: Explicit PI plan approval bound to a CURRENT revision fingerprint.
-- Ordered after M3D-A (selection) and M3D-B (promotion).
-- Does not alter WorkAllocation shape, CURRENT identity, or PiBaseline immutability.

CREATE TYPE "PiPlanApprovalStatus" AS ENUM ('VALID', 'INVALIDATED', 'CONSUMED');

CREATE TABLE "pi_plan_approvals" (
    "id" UUID NOT NULL,
    "piId" UUID NOT NULL,
    "currentRevisionId" UUID NOT NULL,
    "currentRevisionVersion" INTEGER NOT NULL,
    "allocationFingerprint" VARCHAR(64) NOT NULL,
    "promotedFromRevisionId" UUID,
    "approvedByPrincipalId" UUID NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readinessClassification" VARCHAR(40) NOT NULL,
    "readinessEvidence" JSONB NOT NULL,
    "acknowledgeWarnings" BOOLEAN NOT NULL DEFAULT false,
    "status" "PiPlanApprovalStatus" NOT NULL DEFAULT 'VALID',
    "invalidatedAt" TIMESTAMP(3),
    "invalidatedReason" VARCHAR(80),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pi_plan_approvals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pi_plan_approvals_piId_status_idx" ON "pi_plan_approvals"("piId", "status");
CREATE INDEX "pi_plan_approvals_piId_approvedAt_idx" ON "pi_plan_approvals"("piId", "approvedAt");

-- At most one VALID approval per PI.
CREATE UNIQUE INDEX "pi_plan_approvals_one_valid_per_pi"
  ON "pi_plan_approvals"("piId")
  WHERE "status" = 'VALID';

ALTER TABLE "pi_plan_approvals"
  ADD CONSTRAINT "pi_plan_approvals_piId_fkey"
  FOREIGN KEY ("piId") REFERENCES "program_increments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pi_plan_approvals"
  ADD CONSTRAINT "pi_plan_approvals_currentRevisionId_fkey"
  FOREIGN KEY ("currentRevisionId") REFERENCES "planning_revisions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pi_plan_approvals"
  ADD CONSTRAINT "pi_plan_approvals_promotedFromRevisionId_fkey"
  FOREIGN KEY ("promotedFromRevisionId") REFERENCES "planning_revisions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pi_baselines" ADD COLUMN "planApprovalId" UUID;

CREATE UNIQUE INDEX "pi_baselines_planApprovalId_key" ON "pi_baselines"("planApprovalId");

ALTER TABLE "pi_baselines"
  ADD CONSTRAINT "pi_baselines_planApprovalId_fkey"
  FOREIGN KEY ("planApprovalId") REFERENCES "pi_plan_approvals"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
