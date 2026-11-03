-- Nested departments within a section (e.g. INF → INFB / INFF).
ALTER TABLE "departments"
  ADD COLUMN "parentDepartmentId" UUID;

ALTER TABLE "departments"
  ADD CONSTRAINT "departments_parentDepartmentId_fkey"
  FOREIGN KEY ("parentDepartmentId")
  REFERENCES "departments"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "departments_parentDepartmentId_idx"
  ON "departments"("parentDepartmentId");
