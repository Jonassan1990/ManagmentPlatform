-- Phase 1D: ProjectClosure — immutable closure evidence (0..1 per Project).

CREATE TYPE "ProjectClosureOutcome" AS ENUM ('DELIVERED', 'PARTIALLY_DELIVERED', 'CANCELLED');

CREATE TABLE "project_closures" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL,
    "closedByPrincipalId" UUID NOT NULL,
    "outcome" "ProjectClosureOutcome" NOT NULL,
    "summary" VARCHAR(8000),
    "lessonsLearned" VARCHAR(8000),
    "finalDeliveryNote" VARCHAR(8000),
    "readinessSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_closures_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_closures_projectId_key" ON "project_closures"("projectId");

CREATE INDEX "project_closures_closedByPrincipalId_idx" ON "project_closures"("closedByPrincipalId");

CREATE INDEX "project_closures_closedAt_idx" ON "project_closures"("closedAt");

ALTER TABLE "project_closures" ADD CONSTRAINT "project_closures_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_closures" ADD CONSTRAINT "project_closures_closedByPrincipalId_fkey" FOREIGN KEY ("closedByPrincipalId") REFERENCES "principals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
