-- Phase 0B: Referential business ownership via Resource FKs (ADR-021).
-- Additive only. Existing *Name snapshot columns remain.
-- All new FKs: ON DELETE SET NULL — deleting a Resource never erases Initiatives/Projects/etc.

-- Initiative
ALTER TABLE "initiatives" ADD COLUMN "requesterResourceId" UUID;
ALTER TABLE "initiatives" ADD COLUMN "businessOwnerResourceId" UUID;
ALTER TABLE "initiatives" ADD COLUMN "sponsorResourceId" UUID;

CREATE INDEX "initiatives_requesterResourceId_idx" ON "initiatives"("requesterResourceId");
CREATE INDEX "initiatives_businessOwnerResourceId_idx" ON "initiatives"("businessOwnerResourceId");
CREATE INDEX "initiatives_sponsorResourceId_idx" ON "initiatives"("sponsorResourceId");

ALTER TABLE "initiatives"
  ADD CONSTRAINT "initiatives_requesterResourceId_fkey"
  FOREIGN KEY ("requesterResourceId") REFERENCES "resources"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "initiatives"
  ADD CONSTRAINT "initiatives_businessOwnerResourceId_fkey"
  FOREIGN KEY ("businessOwnerResourceId") REFERENCES "resources"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "initiatives"
  ADD CONSTRAINT "initiatives_sponsorResourceId_fkey"
  FOREIGN KEY ("sponsorResourceId") REFERENCES "resources"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Risk
ALTER TABLE "risks" ADD COLUMN "ownerResourceId" UUID;
CREATE INDEX "risks_ownerResourceId_idx" ON "risks"("ownerResourceId");
ALTER TABLE "risks"
  ADD CONSTRAINT "risks_ownerResourceId_fkey"
  FOREIGN KEY ("ownerResourceId") REFERENCES "resources"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- PoC
ALTER TABLE "pocs" ADD COLUMN "ownerResourceId" UUID;
CREATE INDEX "pocs_ownerResourceId_idx" ON "pocs"("ownerResourceId");
ALTER TABLE "pocs"
  ADD CONSTRAINT "pocs_ownerResourceId_fkey"
  FOREIGN KEY ("ownerResourceId") REFERENCES "resources"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Pilot
ALTER TABLE "pilots" ADD COLUMN "ownerResourceId" UUID;
CREATE INDEX "pilots_ownerResourceId_idx" ON "pilots"("ownerResourceId");
ALTER TABLE "pilots"
  ADD CONSTRAINT "pilots_ownerResourceId_fkey"
  FOREIGN KEY ("ownerResourceId") REFERENCES "resources"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Project
ALTER TABLE "projects" ADD COLUMN "ownerResourceId" UUID;
CREATE INDEX "projects_ownerResourceId_idx" ON "projects"("ownerResourceId");
ALTER TABLE "projects"
  ADD CONSTRAINT "projects_ownerResourceId_fkey"
  FOREIGN KEY ("ownerResourceId") REFERENCES "resources"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ProjectMilestone
ALTER TABLE "project_milestones" ADD COLUMN "ownerResourceId" UUID;
CREATE INDEX "project_milestones_ownerResourceId_idx" ON "project_milestones"("ownerResourceId");
ALTER TABLE "project_milestones"
  ADD CONSTRAINT "project_milestones_ownerResourceId_fkey"
  FOREIGN KEY ("ownerResourceId") REFERENCES "resources"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ProjectWorkItem
ALTER TABLE "project_work_items" ADD COLUMN "ownerResourceId" UUID;
CREATE INDEX "project_work_items_ownerResourceId_idx" ON "project_work_items"("ownerResourceId");
ALTER TABLE "project_work_items"
  ADD CONSTRAINT "project_work_items_ownerResourceId_fkey"
  FOREIGN KEY ("ownerResourceId") REFERENCES "resources"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- PlanningDependency
ALTER TABLE "planning_dependencies" ADD COLUMN "ownerResourceId" UUID;
CREATE INDEX "planning_dependencies_ownerResourceId_idx" ON "planning_dependencies"("ownerResourceId");
ALTER TABLE "planning_dependencies"
  ADD CONSTRAINT "planning_dependencies_ownerResourceId_fkey"
  FOREIGN KEY ("ownerResourceId") REFERENCES "resources"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
