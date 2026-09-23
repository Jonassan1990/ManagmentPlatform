-- Phase 5 — Program Increment (PI) Planning
-- Extends Phase 4; does not rewrite earlier migrations.
-- Canonical capacity unit = hours (DECIMAL). Conflicts derived on read (no cache table).

-- CreateEnum
CREATE TYPE "PiStatus" AS ENUM ('DRAFT', 'PLANNING', 'REVIEW', 'BASELINED', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('BLOCKS', 'DEPENDS_ON', 'RELATED');

-- CreateEnum
CREATE TYPE "DependencyStatus" AS ENUM ('OPEN', 'RESOLVED', 'ACCEPTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DependencyCriticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DependencySubjectType" AS ENUM ('WORK_ITEM', 'PROJECT');

-- CreateEnum
CREATE TYPE "PlanningConflictType" AS ENUM (
  'TEAM_OVERLOAD',
  'RESOURCE_OVERLOAD',
  'DEPENDENCY_TIMING',
  'MILESTONE_TIMING',
  'OUTSIDE_PROJECT_DATES',
  'OUTSIDE_PI_DATES',
  'OUTSIDE_ITERATION_DATES',
  'RESOURCE_ALLOCATION_CONFLICT'
);

-- CreateEnum
CREATE TYPE "PlanningConflictSeverity" AS ENUM ('INFO', 'WARNING', 'BLOCKER');

-- AlterTable: ResourceMembership — multi-team capacity share (must sum ≤ 100 across active memberships)
ALTER TABLE "resource_memberships" ADD COLUMN "allocationPercent" DECIMAL(5,2) NOT NULL DEFAULT 100;

-- CreateTable: PiReferenceCounter
CREATE TABLE "pi_reference_counters" (
    "organizationId" UUID NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "pi_reference_counters_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable: ProgramIncrement
CREATE TABLE "program_increments" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "sectionId" UUID,
    "referenceKey" VARCHAR(40) NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "description" VARCHAR(8000),
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "PiStatus" NOT NULL DEFAULT 'DRAFT',
    "planningOwnerName" VARCHAR(200),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "program_increments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PiIteration
CREATE TABLE "pi_iterations" (
    "id" UUID NOT NULL,
    "piId" UUID NOT NULL,
    "referenceKey" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pi_iterations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PiParticipatingDepartment
CREATE TABLE "pi_participating_departments" (
    "id" UUID NOT NULL,
    "piId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "planningOwnerName" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pi_participating_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PiParticipatingTeam
CREATE TABLE "pi_participating_teams" (
    "id" UUID NOT NULL,
    "piId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pi_participating_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PlanningRevision
CREATE TABLE "planning_revisions" (
    "id" UUID NOT NULL,
    "piId" UUID NOT NULL,
    "key" VARCHAR(40) NOT NULL,
    "label" VARCHAR(200),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planning_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: WorkAllocation
CREATE TABLE "work_allocations" (
    "id" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "workItemId" UUID NOT NULL,
    "iterationId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "resourceId" UUID,
    "plannedHours" DECIMAL(10,2) NOT NULL,
    "notes" VARCHAR(4000),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ResourceAvailability
CREATE TABLE "resource_availabilities" (
    "id" UUID NOT NULL,
    "resourceId" UUID NOT NULL,
    "iterationId" UUID NOT NULL,
    "availableHours" DECIMAL(10,2),
    "reductionHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notes" VARCHAR(2000),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resource_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PlanningDependency
CREATE TABLE "planning_dependencies" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "type" "DependencyType" NOT NULL,
    "status" "DependencyStatus" NOT NULL DEFAULT 'OPEN',
    "criticality" "DependencyCriticality" NOT NULL DEFAULT 'MEDIUM',
    "sourceType" "DependencySubjectType" NOT NULL,
    "sourceId" UUID NOT NULL,
    "targetType" "DependencySubjectType" NOT NULL,
    "targetId" UUID NOT NULL,
    "ownerName" VARCHAR(200),
    "neededByDate" TIMESTAMP(3),
    "description" VARCHAR(4000),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planning_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PiBaseline (immutable payload — no updatedAt)
CREATE TABLE "pi_baselines" (
    "id" UUID NOT NULL,
    "piId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "createdByPrincipalId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "label" VARCHAR(200),
    "payload" JSONB NOT NULL,
    "revisionIdCaptured" UUID,

    CONSTRAINT "pi_baselines_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "pi_reference_counters" ADD CONSTRAINT "pi_reference_counters_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "program_increments" ADD CONSTRAINT "program_increments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "program_increments" ADD CONSTRAINT "program_increments_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pi_iterations" ADD CONSTRAINT "pi_iterations_piId_fkey" FOREIGN KEY ("piId") REFERENCES "program_increments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pi_participating_departments" ADD CONSTRAINT "pi_participating_departments_piId_fkey" FOREIGN KEY ("piId") REFERENCES "program_increments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pi_participating_departments" ADD CONSTRAINT "pi_participating_departments_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pi_participating_teams" ADD CONSTRAINT "pi_participating_teams_piId_fkey" FOREIGN KEY ("piId") REFERENCES "program_increments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pi_participating_teams" ADD CONSTRAINT "pi_participating_teams_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "planning_revisions" ADD CONSTRAINT "planning_revisions_piId_fkey" FOREIGN KEY ("piId") REFERENCES "program_increments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "work_allocations" ADD CONSTRAINT "work_allocations_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "planning_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_allocations" ADD CONSTRAINT "work_allocations_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "project_work_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_allocations" ADD CONSTRAINT "work_allocations_iterationId_fkey" FOREIGN KEY ("iterationId") REFERENCES "pi_iterations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_allocations" ADD CONSTRAINT "work_allocations_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_allocations" ADD CONSTRAINT "work_allocations_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "resource_availabilities" ADD CONSTRAINT "resource_availabilities_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resource_availabilities" ADD CONSTRAINT "resource_availabilities_iterationId_fkey" FOREIGN KEY ("iterationId") REFERENCES "pi_iterations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "planning_dependencies" ADD CONSTRAINT "planning_dependencies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pi_baselines" ADD CONSTRAINT "pi_baselines_piId_fkey" FOREIGN KEY ("piId") REFERENCES "program_increments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pi_baselines" ADD CONSTRAINT "pi_baselines_revisionIdCaptured_fkey" FOREIGN KEY ("revisionIdCaptured") REFERENCES "planning_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "program_increments_organizationId_referenceKey_key" ON "program_increments"("organizationId", "referenceKey");
CREATE INDEX "program_increments_organizationId_status_idx" ON "program_increments"("organizationId", "status");
CREATE INDEX "program_increments_sectionId_idx" ON "program_increments"("sectionId");

CREATE UNIQUE INDEX "pi_iterations_piId_sequence_key" ON "pi_iterations"("piId", "sequence");
CREATE UNIQUE INDEX "pi_iterations_piId_referenceKey_key" ON "pi_iterations"("piId", "referenceKey");
CREATE INDEX "pi_iterations_piId_startDate_endDate_idx" ON "pi_iterations"("piId", "startDate", "endDate");

CREATE UNIQUE INDEX "pi_participating_departments_piId_departmentId_key" ON "pi_participating_departments"("piId", "departmentId");
CREATE INDEX "pi_participating_departments_departmentId_idx" ON "pi_participating_departments"("departmentId");

CREATE UNIQUE INDEX "pi_participating_teams_piId_teamId_key" ON "pi_participating_teams"("piId", "teamId");
CREATE INDEX "pi_participating_teams_departmentId_idx" ON "pi_participating_teams"("departmentId");

CREATE UNIQUE INDEX "planning_revisions_piId_key_key" ON "planning_revisions"("piId", "key");
CREATE INDEX "planning_revisions_piId_isCurrent_idx" ON "planning_revisions"("piId", "isCurrent");

CREATE UNIQUE INDEX "work_allocations_revisionId_workItemId_key" ON "work_allocations"("revisionId", "workItemId");
CREATE INDEX "work_allocations_iterationId_teamId_idx" ON "work_allocations"("iterationId", "teamId");
CREATE INDEX "work_allocations_resourceId_idx" ON "work_allocations"("resourceId");

CREATE UNIQUE INDEX "resource_availabilities_resourceId_iterationId_key" ON "resource_availabilities"("resourceId", "iterationId");
CREATE INDEX "resource_availabilities_iterationId_idx" ON "resource_availabilities"("iterationId");

CREATE UNIQUE INDEX "planning_dependencies_sourceType_sourceId_targetType_targetId_type_key" ON "planning_dependencies"("sourceType", "sourceId", "targetType", "targetId", "type");
CREATE INDEX "planning_dependencies_organizationId_status_idx" ON "planning_dependencies"("organizationId", "status");
CREATE INDEX "planning_dependencies_targetType_targetId_idx" ON "planning_dependencies"("targetType", "targetId");

CREATE UNIQUE INDEX "pi_baselines_piId_versionNumber_key" ON "pi_baselines"("piId", "versionNumber");
CREATE INDEX "pi_baselines_piId_createdAt_idx" ON "pi_baselines"("piId", "createdAt");
