-- M3D-A: Explicit selected scenario pointer on ProgramIncrement + prior status restore.
-- Additive only. Does not alter CURRENT allocation semantics.

ALTER TABLE "program_increments" ADD COLUMN "selectedRevisionId" UUID;

CREATE UNIQUE INDEX "program_increments_selectedRevisionId_key" ON "program_increments"("selectedRevisionId");

ALTER TABLE "program_increments"
  ADD CONSTRAINT "program_increments_selectedRevisionId_fkey"
  FOREIGN KEY ("selectedRevisionId") REFERENCES "planning_revisions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "planning_revisions"
  ADD COLUMN "statusBeforeSelection" "PlanningRevisionStatus";

-- Defense in depth: at most one SELECTED revision per PI.
CREATE UNIQUE INDEX "planning_revisions_one_selected_per_pi"
  ON "planning_revisions" ("piId")
  WHERE "status" = 'SELECTED';
