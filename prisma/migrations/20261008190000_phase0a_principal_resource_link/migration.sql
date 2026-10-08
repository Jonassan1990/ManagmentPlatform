-- Phase 0A: Optional Principal ↔ Resource identity bridge (ADR-020).
-- Additive only. Existing resources remain valid with linkedPrincipalId = NULL.
-- ON DELETE SET NULL: deleting a Principal clears the link; never deletes the Resource.

ALTER TABLE "resources" ADD COLUMN "linkedPrincipalId" UUID;

CREATE UNIQUE INDEX "resources_linkedPrincipalId_key" ON "resources"("linkedPrincipalId");

ALTER TABLE "resources"
  ADD CONSTRAINT "resources_linkedPrincipalId_fkey"
  FOREIGN KEY ("linkedPrincipalId")
  REFERENCES "principals"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
