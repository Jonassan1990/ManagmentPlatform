-- Phase 1C — Project Issue management (additive)

CREATE TYPE "IssueSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

CREATE TABLE "project_issues" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "referenceKey" VARCHAR(40) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" VARCHAR(8000),
    "severity" "IssueSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
    "isBlocker" BOOLEAN NOT NULL DEFAULT false,
    "ownerName" VARCHAR(200),
    "ownerResourceId" UUID,
    "relatedRiskId" UUID,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolution" VARCHAR(8000),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_issues_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_issues_projectId_referenceKey_key" ON "project_issues"("projectId", "referenceKey");
CREATE INDEX "project_issues_projectId_status_idx" ON "project_issues"("projectId", "status");
CREATE INDEX "project_issues_projectId_isBlocker_status_idx" ON "project_issues"("projectId", "isBlocker", "status");
CREATE INDEX "project_issues_organizationId_status_idx" ON "project_issues"("organizationId", "status");
CREATE INDEX "project_issues_ownerResourceId_idx" ON "project_issues"("ownerResourceId");
CREATE INDEX "project_issues_relatedRiskId_idx" ON "project_issues"("relatedRiskId");

ALTER TABLE "project_issues" ADD CONSTRAINT "project_issues_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_issues" ADD CONSTRAINT "project_issues_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_issues" ADD CONSTRAINT "project_issues_ownerResourceId_fkey" FOREIGN KEY ("ownerResourceId") REFERENCES "resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_issues" ADD CONSTRAINT "project_issues_relatedRiskId_fkey" FOREIGN KEY ("relatedRiskId") REFERENCES "risks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
