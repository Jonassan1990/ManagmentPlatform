-- Phase 3 — Governance + Approvals + Decisions + PoC
-- Extends Phase 2; does not rewrite earlier migrations.

-- AlterEnum: add POC to InitiativeStage
ALTER TYPE "InitiativeStage" ADD VALUE 'POC';

-- CreateEnum
CREATE TYPE "GateType" AS ENUM ('PRE_STUDY_GATE', 'POC_GATE');

-- CreateEnum
CREATE TYPE "GovernanceSubmissionStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVALS_COMPLETE', 'DECISION_RECORDED', 'SUPERSEDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalRequestStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalOutcome" AS ENUM ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "DecisionOutcome" AS ENUM ('GO', 'CONDITIONAL_GO', 'NO_GO', 'HOLD');

-- CreateEnum
CREATE TYPE "DecisionConditionStatus" AS ENUM ('OPEN', 'RESOLVED', 'WAIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PoCStatus" AS ENUM ('DRAFT', 'READY', 'IN_PROGRESS', 'EVALUATION', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CriterionEvaluationState" AS ENUM ('NOT_EVALUATED', 'PASS', 'FAIL', 'INCONCLUSIVE');

-- CreateEnum
CREATE TYPE "EvidenceEntryKind" AS ENUM ('DOCUMENT_VERSION', 'REQUIREMENT', 'ASSESSMENT', 'RISK', 'ALTERNATIVE', 'POC_RESULT', 'READINESS_SUMMARY', 'OTHER');

-- CreateEnum
CREATE TYPE "EvidenceRequirementLevel" AS ENUM ('REQUIRED', 'OPTIONAL');

-- CreateTable
CREATE TABLE "requirement_reference_counters" (
    "initiativeId" UUID NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "requirement_reference_counters_pkey" PRIMARY KEY ("initiativeId")
);

-- CreateTable
CREATE TABLE "risk_reference_counters" (
    "initiativeId" UUID NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "risk_reference_counters_pkey" PRIMARY KEY ("initiativeId")
);

-- CreateTable
CREATE TABLE "governance_gates" (
    "id" UUID NOT NULL,
    "initiativeId" UUID NOT NULL,
    "gateType" "GateType" NOT NULL,
    "stage" "InitiativeStage" NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "governance_gates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_snapshots" (
    "id" UUID NOT NULL,
    "initiativeId" UUID NOT NULL,
    "gateType" "GateType" NOT NULL,
    "revision" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance_submissions" (
    "id" UUID NOT NULL,
    "gateId" UUID NOT NULL,
    "initiativeId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" "GovernanceSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedByPrincipalId" UUID NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewSnapshotId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersededBySubmissionId" UUID,
    "previousSubmissionId" UUID,
    "notes" VARCHAR(4000),

    CONSTRAINT "governance_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_packages" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "gateId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_entries" (
    "id" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "kind" "EvidenceEntryKind" NOT NULL,
    "requirementLevel" "EvidenceRequirementLevel" NOT NULL DEFAULT 'REQUIRED',
    "label" VARCHAR(300) NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT false,
    "referenceType" VARCHAR(100),
    "referenceId" UUID,
    "snapshotBinding" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "evidence_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requirement_templates" (
    "id" UUID NOT NULL,
    "gateType" "GateType" NOT NULL,
    "authorityKey" VARCHAR(100) NOT NULL,
    "requiredPermission" VARCHAR(200) NOT NULL,
    "label" VARCHAR(300) NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "conditionNote" VARCHAR(2000),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "approval_requirement_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "requirementTemplateId" UUID,
    "authorityKey" VARCHAR(100) NOT NULL,
    "requiredPermission" VARCHAR(200) NOT NULL,
    "label" VARCHAR(300) NOT NULL,
    "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "assignedPrincipalId" UUID,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewSnapshotId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_records" (
    "id" UUID NOT NULL,
    "approvalRequestId" UUID NOT NULL,
    "approverPrincipalId" UUID NOT NULL,
    "outcome" "ApprovalOutcome" NOT NULL,
    "comment" VARCHAR(4000),
    "conditionsText" VARCHAR(4000),
    "reviewSnapshotId" UUID NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_packages" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "gateId" UUID NOT NULL,
    "initiativeId" UUID NOT NULL,
    "question" VARCHAR(2000) NOT NULL,
    "whyNeeded" VARCHAR(4000) NOT NULL,
    "recommendationText" VARCHAR(4000),
    "recommendationAlternativeId" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decision_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_records" (
    "id" UUID NOT NULL,
    "referenceKey" VARCHAR(40) NOT NULL,
    "gateId" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "decisionPackageId" UUID NOT NULL,
    "initiativeId" UUID NOT NULL,
    "question" VARCHAR(2000) NOT NULL,
    "optionsConsidered" JSONB NOT NULL,
    "recommendationText" VARCHAR(4000),
    "outcome" "DecisionOutcome" NOT NULL,
    "rationale" VARCHAR(8000) NOT NULL,
    "decisionMakerPrincipalId" UUID NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewSnapshotId" UUID NOT NULL,
    "evidencePackageId" UUID NOT NULL,
    "supersedesDecisionId" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "decision_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_conditions" (
    "id" UUID NOT NULL,
    "decisionId" UUID NOT NULL,
    "description" VARCHAR(4000) NOT NULL,
    "ownerName" VARCHAR(200),
    "dueDate" TIMESTAMP(3),
    "status" "DecisionConditionStatus" NOT NULL DEFAULT 'OPEN',
    "requiredBeforeProgression" BOOLEAN NOT NULL DEFAULT true,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" VARCHAR(4000),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "decision_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pocs" (
    "id" UUID NOT NULL,
    "initiativeId" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "objective" VARCHAR(4000) NOT NULL,
    "hypothesis" VARCHAR(4000) NOT NULL,
    "scope" VARCHAR(4000) NOT NULL,
    "outOfScope" VARCHAR(4000),
    "ownerName" VARCHAR(200),
    "plannedStart" TIMESTAMP(3),
    "plannedEnd" TIMESTAMP(3),
    "estimatedCost" VARCHAR(500),
    "resourceNotes" VARCHAR(4000),
    "technicalConstraints" VARCHAR(4000),
    "dependencyNotes" VARCHAR(4000),
    "results" VARCHAR(8000),
    "findings" VARCHAR(8000),
    "lessonsLearned" VARCHAR(8000),
    "actualCost" VARCHAR(500),
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "status" "PoCStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pocs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poc_success_criteria" (
    "id" UUID NOT NULL,
    "pocId" UUID NOT NULL,
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

    CONSTRAINT "poc_success_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "governance_gates_initiativeId_gateType_key" ON "governance_gates"("initiativeId", "gateType");

-- CreateIndex
CREATE INDEX "governance_gates_initiativeId_status_idx" ON "governance_gates"("initiativeId", "status");

-- CreateIndex
CREATE INDEX "review_snapshots_initiativeId_gateType_revision_idx" ON "review_snapshots"("initiativeId", "gateType", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "governance_submissions_gateId_revision_key" ON "governance_submissions"("gateId", "revision");

-- CreateIndex
CREATE INDEX "governance_submissions_initiativeId_status_idx" ON "governance_submissions"("initiativeId", "status");

-- CreateIndex
CREATE INDEX "governance_submissions_reviewSnapshotId_idx" ON "governance_submissions"("reviewSnapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_packages_submissionId_key" ON "evidence_packages"("submissionId");

-- CreateIndex
CREATE INDEX "evidence_packages_gateId_idx" ON "evidence_packages"("gateId");

-- CreateIndex
CREATE INDEX "evidence_entries_packageId_sortOrder_idx" ON "evidence_entries"("packageId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "approval_requirement_templates_gateType_authorityKey_key" ON "approval_requirement_templates"("gateType", "authorityKey");

-- CreateIndex
CREATE INDEX "approval_requirement_templates_gateType_active_idx" ON "approval_requirement_templates"("gateType", "active");

-- CreateIndex
CREATE INDEX "approval_requests_submissionId_status_idx" ON "approval_requests"("submissionId", "status");

-- CreateIndex
CREATE INDEX "approval_requests_reviewSnapshotId_idx" ON "approval_requests"("reviewSnapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "approval_records_approvalRequestId_key" ON "approval_records"("approvalRequestId");

-- CreateIndex
CREATE INDEX "approval_records_reviewSnapshotId_idx" ON "approval_records"("reviewSnapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "decision_packages_submissionId_key" ON "decision_packages"("submissionId");

-- CreateIndex
CREATE INDEX "decision_packages_initiativeId_idx" ON "decision_packages"("initiativeId");

-- CreateIndex
CREATE INDEX "decision_packages_gateId_idx" ON "decision_packages"("gateId");

-- CreateIndex
CREATE UNIQUE INDEX "decision_records_submissionId_key" ON "decision_records"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "decision_records_decisionPackageId_key" ON "decision_records"("decisionPackageId");

-- CreateIndex
CREATE UNIQUE INDEX "decision_records_initiativeId_referenceKey_key" ON "decision_records"("initiativeId", "referenceKey");

-- CreateIndex
CREATE INDEX "decision_records_gateId_idx" ON "decision_records"("gateId");

-- CreateIndex
CREATE INDEX "decision_records_initiativeId_outcome_idx" ON "decision_records"("initiativeId", "outcome");

-- CreateIndex
CREATE INDEX "decision_conditions_decisionId_status_idx" ON "decision_conditions"("decisionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pocs_initiativeId_key" ON "pocs"("initiativeId");

-- CreateIndex
CREATE INDEX "pocs_status_idx" ON "pocs"("status");

-- CreateIndex
CREATE INDEX "poc_success_criteria_pocId_sortOrder_idx" ON "poc_success_criteria"("pocId", "sortOrder");

-- AddForeignKey
ALTER TABLE "requirement_reference_counters" ADD CONSTRAINT "requirement_reference_counters_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_reference_counters" ADD CONSTRAINT "risk_reference_counters_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_gates" ADD CONSTRAINT "governance_gates_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_snapshots" ADD CONSTRAINT "review_snapshots_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_submissions" ADD CONSTRAINT "governance_submissions_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "governance_gates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_submissions" ADD CONSTRAINT "governance_submissions_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_submissions" ADD CONSTRAINT "governance_submissions_reviewSnapshotId_fkey" FOREIGN KEY ("reviewSnapshotId") REFERENCES "review_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_submissions" ADD CONSTRAINT "governance_submissions_supersededBySubmissionId_fkey" FOREIGN KEY ("supersededBySubmissionId") REFERENCES "governance_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_submissions" ADD CONSTRAINT "governance_submissions_previousSubmissionId_fkey" FOREIGN KEY ("previousSubmissionId") REFERENCES "governance_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_packages" ADD CONSTRAINT "evidence_packages_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "governance_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_packages" ADD CONSTRAINT "evidence_packages_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "governance_gates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_entries" ADD CONSTRAINT "evidence_entries_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "evidence_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "governance_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requirementTemplateId_fkey" FOREIGN KEY ("requirementTemplateId") REFERENCES "approval_requirement_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_reviewSnapshotId_fkey" FOREIGN KEY ("reviewSnapshotId") REFERENCES "review_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "approval_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_reviewSnapshotId_fkey" FOREIGN KEY ("reviewSnapshotId") REFERENCES "review_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_packages" ADD CONSTRAINT "decision_packages_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "governance_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_packages" ADD CONSTRAINT "decision_packages_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "governance_gates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_records" ADD CONSTRAINT "decision_records_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "governance_gates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_records" ADD CONSTRAINT "decision_records_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "governance_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_records" ADD CONSTRAINT "decision_records_decisionPackageId_fkey" FOREIGN KEY ("decisionPackageId") REFERENCES "decision_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_records" ADD CONSTRAINT "decision_records_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_records" ADD CONSTRAINT "decision_records_reviewSnapshotId_fkey" FOREIGN KEY ("reviewSnapshotId") REFERENCES "review_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_records" ADD CONSTRAINT "decision_records_evidencePackageId_fkey" FOREIGN KEY ("evidencePackageId") REFERENCES "evidence_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_records" ADD CONSTRAINT "decision_records_supersedesDecisionId_fkey" FOREIGN KEY ("supersedesDecisionId") REFERENCES "decision_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_conditions" ADD CONSTRAINT "decision_conditions_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "decision_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pocs" ADD CONSTRAINT "pocs_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poc_success_criteria" ADD CONSTRAINT "poc_success_criteria_pocId_fkey" FOREIGN KEY ("pocId") REFERENCES "pocs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
