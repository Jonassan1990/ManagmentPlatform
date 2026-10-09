-- M3D-B: Promotion provenance on ProgramIncrement (additive).
-- Does not alter WorkAllocation shape, CURRENT identity, or PiBaseline immutability.

ALTER TABLE "program_increments" ADD COLUMN "lastPromotedFromRevisionId" UUID;
ALTER TABLE "program_increments" ADD COLUMN "lastPromotedAt" TIMESTAMP(3);
ALTER TABLE "program_increments" ADD COLUMN "lastPromotedByPrincipalId" UUID;

CREATE INDEX "program_increments_lastPromotedFromRevisionId_idx"
  ON "program_increments"("lastPromotedFromRevisionId");

ALTER TABLE "program_increments"
  ADD CONSTRAINT "program_increments_lastPromotedFromRevisionId_fkey"
  FOREIGN KEY ("lastPromotedFromRevisionId") REFERENCES "planning_revisions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
