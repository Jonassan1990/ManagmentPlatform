-- CreateEnum
CREATE TYPE "InitiativeStage" AS ENUM ('DEMAND', 'REQUIREMENTS', 'PRE_STUDY');

-- CreateEnum
CREATE TYPE "InitiativeStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DemandUrgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RequirementCategory" AS ENUM ('BUSINESS', 'FUNCTIONAL', 'NON_FUNCTIONAL', 'ARCHITECTURE', 'SECURITY', 'INTEGRATION', 'DATA', 'COMPLIANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "RequirementPriority" AS ENUM ('MUST', 'SHOULD', 'COULD', 'WONT');

-- CreateEnum
CREATE TYPE "RequirementStatus" AS ENUM ('DRAFT', 'PROPOSED', 'ACCEPTED', 'DEFERRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RequirementRelationType" AS ENUM ('DEPENDS_ON', 'RELATED_TO', 'REFINES', 'CONFLICTS_WITH');

-- CreateEnum
CREATE TYPE "AssessmentArea" AS ENUM ('BUSINESS', 'CURRENT_STATE', 'ARCHITECTURE', 'SECURITY', 'INTEGRATION', 'DATA', 'COST', 'RESOURCES', 'RISK', 'OTHER');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE');

-- CreateEnum
CREATE TYPE "RiskProbability" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "RiskImpact" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('OPEN', 'MITIGATING', 'ACCEPTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DocumentLifecycleStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "initiative_reference_counters" (
    "organizationId" UUID NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "initiative_reference_counters_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "initiatives" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "referenceKey" VARCHAR(40) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "requesterName" VARCHAR(200) NOT NULL,
    "requesterContact" VARCHAR(300),
    "businessOwnerName" VARCHAR(200) NOT NULL,
    "businessOwnerContact" VARCHAR(300),
    "currentStage" "InitiativeStage" NOT NULL DEFAULT 'DEMAND',
    "status" "InitiativeStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "initiatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lifecycle_transitions" (
    "id" UUID NOT NULL,
    "initiativeId" UUID NOT NULL,
    "fromStage" "InitiativeStage" NOT NULL,
    "toStage" "InitiativeStage" NOT NULL,
    "actorPrincipalId" UUID,
    "comment" VARCHAR(2000),
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lifecycle_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demands" (
    "id" UUID NOT NULL,
    "initiativeId" UUID NOT NULL,
    "problemOpportunity" VARCHAR(4000) NOT NULL,
    "reasonForRequest" VARCHAR(4000) NOT NULL,
    "expectedValue" VARCHAR(4000) NOT NULL,
    "affectedAreas" VARCHAR(2000) NOT NULL,
    "urgency" "DemandUrgency" NOT NULL DEFAULT 'MEDIUM',
    "strategicAlignment" VARCHAR(2000) NOT NULL,
    "initialImpact" VARCHAR(2000) NOT NULL,
    "notes" VARCHAR(4000),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirements" (
    "id" UUID NOT NULL,
    "initiativeId" UUID NOT NULL,
    "referenceKey" VARCHAR(40) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" VARCHAR(8000) NOT NULL,
    "category" "RequirementCategory" NOT NULL,
    "priority" "RequirementPriority" NOT NULL DEFAULT 'SHOULD',
    "ownerName" VARCHAR(200),
    "source" VARCHAR(500),
    "status" "RequirementStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acceptance_criteria" (
    "id" UUID NOT NULL,
    "requirementId" UUID NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acceptance_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_relations" (
    "id" UUID NOT NULL,
    "fromRequirementId" UUID NOT NULL,
    "toRequirementId" UUID NOT NULL,
    "relationType" "RequirementRelationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirement_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pre_studies" (
    "id" UUID NOT NULL,
    "initiativeId" UUID NOT NULL,
    "summary" VARCHAR(4000),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pre_studies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pre_study_assessments" (
    "id" UUID NOT NULL,
    "preStudyId" UUID NOT NULL,
    "area" "AssessmentArea" NOT NULL,
    "ownerName" VARCHAR(200),
    "status" "AssessmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "summary" VARCHAR(4000),
    "findings" VARCHAR(8000),
    "conclusion" VARCHAR(4000),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pre_study_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solution_alternatives" (
    "id" UUID NOT NULL,
    "preStudyId" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" VARCHAR(4000) NOT NULL,
    "benefits" VARCHAR(4000),
    "drawbacks" VARCHAR(4000),
    "estimatedCost" VARCHAR(500),
    "estimatedDuration" VARCHAR(200),
    "riskUncertainty" VARCHAR(2000),
    "notes" VARCHAR(4000),
    "isRecommended" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solution_alternatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risks" (
    "id" UUID NOT NULL,
    "initiativeId" UUID NOT NULL,
    "referenceKey" VARCHAR(40) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" VARCHAR(4000) NOT NULL,
    "ownerName" VARCHAR(200),
    "probability" "RiskProbability" NOT NULL DEFAULT 'MEDIUM',
    "impact" "RiskImpact" NOT NULL DEFAULT 'MEDIUM',
    "status" "RiskStatus" NOT NULL DEFAULT 'OPEN',
    "mitigation" VARCHAR(4000),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "managed_documents" (
    "id" UUID NOT NULL,
    "initiativeId" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "ownerName" VARCHAR(200),
    "stage" "InitiativeStage",
    "assessmentArea" "AssessmentArea",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "managed_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "versionLabel" VARCHAR(40) NOT NULL,
    "lifecycleStatus" "DocumentLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "storagePointer" VARCHAR(1000),
    "changeSummary" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "initiatives_organizationId_currentStage_status_idx" ON "initiatives"("organizationId", "currentStage", "status");

-- CreateIndex
CREATE INDEX "initiatives_departmentId_idx" ON "initiatives"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "initiatives_organizationId_referenceKey_key" ON "initiatives"("organizationId", "referenceKey");

-- CreateIndex
CREATE INDEX "lifecycle_transitions_initiativeId_occurredAt_idx" ON "lifecycle_transitions"("initiativeId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "demands_initiativeId_key" ON "demands"("initiativeId");

-- CreateIndex
CREATE INDEX "requirements_initiativeId_status_idx" ON "requirements"("initiativeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "requirements_initiativeId_referenceKey_key" ON "requirements"("initiativeId", "referenceKey");

-- CreateIndex
CREATE INDEX "acceptance_criteria_requirementId_sortOrder_idx" ON "acceptance_criteria"("requirementId", "sortOrder");

-- CreateIndex
CREATE INDEX "requirement_relations_toRequirementId_idx" ON "requirement_relations"("toRequirementId");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_relations_fromRequirementId_toRequirementId_rel_key" ON "requirement_relations"("fromRequirementId", "toRequirementId", "relationType");

-- CreateIndex
CREATE UNIQUE INDEX "pre_studies_initiativeId_key" ON "pre_studies"("initiativeId");

-- CreateIndex
CREATE INDEX "pre_study_assessments_preStudyId_status_idx" ON "pre_study_assessments"("preStudyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pre_study_assessments_preStudyId_area_key" ON "pre_study_assessments"("preStudyId", "area");

-- CreateIndex
CREATE INDEX "solution_alternatives_preStudyId_idx" ON "solution_alternatives"("preStudyId");

-- CreateIndex
CREATE INDEX "risks_initiativeId_status_idx" ON "risks"("initiativeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "risks_initiativeId_referenceKey_key" ON "risks"("initiativeId", "referenceKey");

-- CreateIndex
CREATE INDEX "managed_documents_initiativeId_idx" ON "managed_documents"("initiativeId");

-- CreateIndex
CREATE INDEX "document_versions_documentId_idx" ON "document_versions"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_documentId_versionLabel_key" ON "document_versions"("documentId", "versionLabel");

-- AddForeignKey
ALTER TABLE "initiative_reference_counters" ADD CONSTRAINT "initiative_reference_counters_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lifecycle_transitions" ADD CONSTRAINT "lifecycle_transitions_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acceptance_criteria" ADD CONSTRAINT "acceptance_criteria_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_relations" ADD CONSTRAINT "requirement_relations_fromRequirementId_fkey" FOREIGN KEY ("fromRequirementId") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_relations" ADD CONSTRAINT "requirement_relations_toRequirementId_fkey" FOREIGN KEY ("toRequirementId") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_studies" ADD CONSTRAINT "pre_studies_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_study_assessments" ADD CONSTRAINT "pre_study_assessments_preStudyId_fkey" FOREIGN KEY ("preStudyId") REFERENCES "pre_studies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solution_alternatives" ADD CONSTRAINT "solution_alternatives_preStudyId_fkey" FOREIGN KEY ("preStudyId") REFERENCES "pre_studies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risks" ADD CONSTRAINT "risks_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "managed_documents" ADD CONSTRAINT "managed_documents_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "managed_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
