-- M3B — PlanningRevision scenario lifecycle & provenance (additive).
-- Preserves existing CURRENT revisions; no allocation table rewrite.

-- CreateEnum
CREATE TYPE "PlanningRevisionStatus" AS ENUM (
  'ACTIVE_PLAN',
  'DRAFT',
  'READY_FOR_REVIEW',
  'SELECTED',
  'ARCHIVED',
  'PROMOTED'
);

-- AlterTable
ALTER TABLE "planning_revisions"
  ADD COLUMN "status" "PlanningRevisionStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "clonedFromRevisionId" UUID,
  ADD COLUMN "createdByPrincipalId" UUID,
  ADD COLUMN "selectedAt" TIMESTAMP(3),
  ADD COLUMN "selectedByPrincipalId" UUID;

-- Backfill: existing CURRENT rows become ACTIVE_PLAN; any non-current stay DRAFT.
UPDATE "planning_revisions"
SET "status" = 'ACTIVE_PLAN',
    "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP)
WHERE "isCurrent" = true;

UPDATE "planning_revisions"
SET "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP)
WHERE "isCurrent" = false;

-- Self-FK for clone provenance
ALTER TABLE "planning_revisions"
  ADD CONSTRAINT "planning_revisions_clonedFromRevisionId_fkey"
  FOREIGN KEY ("clonedFromRevisionId") REFERENCES "planning_revisions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "planning_revisions_piId_status_idx"
  ON "planning_revisions"("piId", "status");

-- Exactly one CURRENT revision per PI (product invariant).
CREATE UNIQUE INDEX "planning_revisions_one_current_per_pi"
  ON "planning_revisions"("piId")
  WHERE "isCurrent" = true;
