-- CreateEnum
CREATE TYPE "OnboardingChecklistStatus" AS ENUM ('IN_PROGRESS', 'PASSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OnboardingAuditAction" AS ENUM ('CREATED', 'EMPLOYEE_CHECKED', 'EMPLOYEE_UNCHECKED', 'ONBOARDER_CHECKED', 'ONBOARDER_UNCHECKED', 'PASSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "onboarding_checklists" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "employeePrincipalId" UUID NOT NULL,
    "onboarderPrincipalId" UUID NOT NULL,
    "status" "OnboardingChecklistStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "passedAt" TIMESTAMP(3),
    "notes" VARCHAR(4000),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByPrincipalId" UUID,

    CONSTRAINT "onboarding_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_checklist_items" (
    "id" UUID NOT NULL,
    "checklistId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" VARCHAR(300) NOT NULL,
    "description" VARCHAR(2000),
    "employeeCheckedAt" TIMESTAMP(3),
    "employeeCheckedByPrincipalId" UUID,
    "onboarderCheckedAt" TIMESTAMP(3),
    "onboarderCheckedByPrincipalId" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_checklist_audits" (
    "id" UUID NOT NULL,
    "checklistId" UUID NOT NULL,
    "itemId" UUID,
    "actorPrincipalId" UUID,
    "action" "OnboardingAuditAction" NOT NULL,
    "comment" VARCHAR(4000),
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_checklist_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "onboarding_checklists_organizationId_status_idx" ON "onboarding_checklists"("organizationId", "status");

-- CreateIndex
CREATE INDEX "onboarding_checklists_employeePrincipalId_status_idx" ON "onboarding_checklists"("employeePrincipalId", "status");

-- CreateIndex
CREATE INDEX "onboarding_checklists_onboarderPrincipalId_status_idx" ON "onboarding_checklists"("onboarderPrincipalId", "status");

-- CreateIndex
CREATE INDEX "onboarding_checklist_items_checklistId_sortOrder_idx" ON "onboarding_checklist_items"("checklistId", "sortOrder");

-- CreateIndex
CREATE INDEX "onboarding_checklist_audits_checklistId_createdAt_idx" ON "onboarding_checklist_audits"("checklistId", "createdAt");

-- AddForeignKey
ALTER TABLE "onboarding_checklists" ADD CONSTRAINT "onboarding_checklists_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_checklist_items" ADD CONSTRAINT "onboarding_checklist_items_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "onboarding_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_checklist_audits" ADD CONSTRAINT "onboarding_checklist_audits_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "onboarding_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
