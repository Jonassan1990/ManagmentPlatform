-- Phase 4 — Pilot + Project conversion
-- Extends Phase 3; does not rewrite earlier migrations.
-- Money columns use DECIMAL(18,2) — never Float.

-- AlterEnum: InitiativeStage
ALTER TYPE "InitiativeStage" ADD VALUE 'PILOT';
ALTER TYPE "InitiativeStage" ADD VALUE 'PROJECT';

-- AlterEnum: GateType
ALTER TYPE "GateType" ADD VALUE 'PILOT_GATE';

-- AlterEnum: DecisionOutcome (Pilot gate outcomes; earlier gate values retained)
ALTER TYPE "DecisionOutcome" ADD VALUE 'SCALE';
ALTER TYPE "DecisionOutcome" ADD VALUE 'EXTEND_PILOT';
ALTER TYPE "DecisionOutcome" ADD VALUE 'CONDITIONAL_SCALE';
ALTER TYPE "DecisionOutcome" ADD VALUE 'STOP';

-- AlterEnum: EvidenceEntryKind
ALTER TYPE "EvidenceEntryKind" ADD VALUE 'PILOT_RESULT';

-- CreateEnum
CREATE TYPE "PilotStatus" AS ENUM ('DRAFT', 'READY', 'IN_PROGRESS', 'EVALUATION', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PilotCriterionCategory" AS ENUM ('TECHNICAL', 'BUSINESS', 'OPERATIONAL', 'SECURITY', 'ARCHITECTURE', 'USER_ADOPTION', 'PERFORMANCE', 'COST', 'OTHER');

-- CreateEnum
CREATE TYPE "FeedbackSentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'MIXED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProjectPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'MISSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkItemType" AS ENUM ('EPIC', 'FEATURE', 'TASK');

-- CreateEnum
CREATE TYPE "WorkItemStatus" AS ENUM ('BACKLOG', 'READY', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkItemPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- AlterTable: GovernanceSubmission — store policy version used at submit time
ALTER TABLE "governance_submissions" ADD COLUMN "policyVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable: ApprovalRequirementTemplate — MVP policy versioning
ALTER TABLE "approval_requirement_templates" ADD COLUMN "policyVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "approval_requirement_templates" ADD COLUMN "supersededAt" TIMESTAMP(3);

DROP INDEX IF EXISTS "approval_requirement_templates_gateType_authorityKey_key";
CREATE UNIQUE INDEX "approval_requirement_templates_gateType_authorityKey_policyVersion_key"
  ON "approval_requirement_templates"("gateType", "authorityKey", "policyVersion");

DROP INDEX IF EXISTS "approval_requirement_templates_gateType_active_idx";
CREATE INDEX "approval_requirement_templates_gateType_active_supersededAt_idx"
  ON "approval_requirement_templates"("gateType", "active", "supersededAt");

-- CreateTable: ProjectReferenceCounter
CREATE TABLE "project_reference_counters" (
    "organizationId" UUID NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "project_reference_counters_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable: Pilot
CREATE TABLE "pilots" (
    "id" UUID NOT NULL,
    "initiativeId" UUID NOT NULL,
    "objective" VARCHAR(4000) NOT NULL,
    "scope" VARCHAR(4000) NOT NULL,
    "outOfScope" VARCHAR(4000),
    "ownerName" VARCHAR(200),
    "siteOrArea" VARCHAR(1000),
    "targetUsers" VARCHAR(2000),
    "plannedStart" TIMESTAMP(3),
    "plannedEnd" TIMESTAMP(3),
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "estimatedCost" DECIMAL(18,2),
    "actualCost" DECIMAL(18,2),
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "resourceNotes" VARCHAR(4000),
    "environment" VARCHAR(2000),
    "operationalConstraints" VARCHAR(4000),
    "supportModel" VARCHAR(4000),
    "rollbackPlan" VARCHAR(4000),
    "results" VARCHAR(8000),
    "businessFindings" VARCHAR(8000),
    "technicalFindings" VARCHAR(8000),
    "operationalFindings" VARCHAR(8000),
    "userFeedbackSummary" VARCHAR(8000),
    "lessonsLearned" VARCHAR(8000),
    "status" "PilotStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pilots_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PilotCriterion
CREATE TABLE "pilot_criteria" (
    "id" UUID NOT NULL,
    "pilotId" UUID NOT NULL,
    "category" "PilotCriterionCategory" NOT NULL DEFAULT 'OTHER',
    "title" VARCHAR(300) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "measurementMethod" VARCHAR(2000) NOT NULL,
    "target" VARCHAR(1000) NOT NULL,
    "unit" VARCHAR(100),
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "evaluationState" "CriterionEvaluationState" NOT NULL DEFAULT 'NOT_EVALUATED',
    "actualResult" VARCHAR(2000),
    "evidenceReference" VARCHAR(1000),
    "evaluationNotes" VARCHAR(4000),
    "evaluatedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "pilot_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PilotFeedback
CREATE TABLE "pilot_feedback" (
    "id" UUID NOT NULL,
    "pilotId" UUID NOT NULL,
    "sourceType" VARCHAR(100) NOT NULL,
    "summary" VARCHAR(4000) NOT NULL,
    "details" VARCHAR(8000),
    "sentiment" "FeedbackSentiment",
    "submittedByName" VARCHAR(200),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "pilot_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PilotExtension
CREATE TABLE "pilot_extensions" (
    "id" UUID NOT NULL,
    "pilotId" UUID NOT NULL,
    "decisionId" UUID,
    "previousPlannedEnd" TIMESTAMP(3),
    "newPlannedEnd" TIMESTAMP(3) NOT NULL,
    "reason" VARCHAR(4000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pilot_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Project
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "initiativeId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "referenceKey" VARCHAR(40) NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "description" VARCHAR(8000),
    "ownerName" VARCHAR(200),
    "departmentId" UUID NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "priority" "ProjectPriority" NOT NULL DEFAULT 'MEDIUM',
    "plannedStart" TIMESTAMP(3),
    "plannedEnd" TIMESTAMP(3),
    "estimatedCost" DECIMAL(18,2),
    "approvedBudget" DECIMAL(18,2),
    "plannedCost" DECIMAL(18,2),
    "forecastCost" DECIMAL(18,2),
    "actualCost" DECIMAL(18,2),
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "objectives" VARCHAR(8000),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProjectParticipatingDepartment
CREATE TABLE "project_participating_departments" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_participating_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProjectMilestone
CREATE TABLE "project_milestones" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "referenceKey" VARCHAR(40) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" VARCHAR(4000),
    "ownerName" VARCHAR(200),
    "plannedDate" TIMESTAMP(3),
    "actualDate" TIMESTAMP(3),
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PLANNED',
    "criticality" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProjectWorkItem
CREATE TABLE "project_work_items" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "type" "WorkItemType" NOT NULL,
    "referenceKey" VARCHAR(40) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" VARCHAR(8000),
    "ownerName" VARCHAR(200),
    "status" "WorkItemStatus" NOT NULL DEFAULT 'BACKLOG',
    "priority" "WorkItemPriority" NOT NULL DEFAULT 'MEDIUM',
    "estimateHours" DECIMAL(10,2),
    "parentId" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_work_items_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "pilots_initiativeId_key" ON "pilots"("initiativeId");
CREATE INDEX "pilots_status_idx" ON "pilots"("status");

CREATE INDEX "pilot_criteria_pilotId_sortOrder_idx" ON "pilot_criteria"("pilotId", "sortOrder");

CREATE INDEX "pilot_feedback_pilotId_submittedAt_idx" ON "pilot_feedback"("pilotId", "submittedAt");

CREATE INDEX "pilot_extensions_pilotId_createdAt_idx" ON "pilot_extensions"("pilotId", "createdAt");

CREATE UNIQUE INDEX "projects_initiativeId_key" ON "projects"("initiativeId");
CREATE UNIQUE INDEX "projects_organizationId_referenceKey_key" ON "projects"("organizationId", "referenceKey");
CREATE INDEX "projects_departmentId_status_idx" ON "projects"("departmentId", "status");
CREATE INDEX "projects_status_priority_idx" ON "projects"("status", "priority");

CREATE UNIQUE INDEX "project_participating_departments_projectId_departmentId_key"
  ON "project_participating_departments"("projectId", "departmentId");
CREATE INDEX "project_participating_departments_departmentId_idx"
  ON "project_participating_departments"("departmentId");

CREATE UNIQUE INDEX "project_milestones_projectId_referenceKey_key"
  ON "project_milestones"("projectId", "referenceKey");
CREATE INDEX "project_milestones_projectId_status_idx"
  ON "project_milestones"("projectId", "status");

CREATE UNIQUE INDEX "project_work_items_projectId_referenceKey_key"
  ON "project_work_items"("projectId", "referenceKey");
CREATE INDEX "project_work_items_projectId_status_idx"
  ON "project_work_items"("projectId", "status");
CREATE INDEX "project_work_items_parentId_idx"
  ON "project_work_items"("parentId");

-- ForeignKeys
ALTER TABLE "project_reference_counters"
  ADD CONSTRAINT "project_reference_counters_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pilots"
  ADD CONSTRAINT "pilots_initiativeId_fkey"
  FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pilot_criteria"
  ADD CONSTRAINT "pilot_criteria_pilotId_fkey"
  FOREIGN KEY ("pilotId") REFERENCES "pilots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pilot_feedback"
  ADD CONSTRAINT "pilot_feedback_pilotId_fkey"
  FOREIGN KEY ("pilotId") REFERENCES "pilots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pilot_extensions"
  ADD CONSTRAINT "pilot_extensions_pilotId_fkey"
  FOREIGN KEY ("pilotId") REFERENCES "pilots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pilot_extensions"
  ADD CONSTRAINT "pilot_extensions_decisionId_fkey"
  FOREIGN KEY ("decisionId") REFERENCES "decision_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_initiativeId_fkey"
  FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_participating_departments"
  ADD CONSTRAINT "project_participating_departments_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_participating_departments"
  ADD CONSTRAINT "project_participating_departments_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_milestones"
  ADD CONSTRAINT "project_milestones_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_work_items"
  ADD CONSTRAINT "project_work_items_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_work_items"
  ADD CONSTRAINT "project_work_items_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "project_work_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
