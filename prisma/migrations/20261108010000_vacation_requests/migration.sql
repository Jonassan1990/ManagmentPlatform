-- CreateEnum
CREATE TYPE "VacationRequestStatus" AS ENUM ('SUBMITTED', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VacationAuditAction" AS ENUM ('CREATED', 'UPDATED', 'RESUBMITTED', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "vacation_requests" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "requesterPrincipalId" UUID NOT NULL,
    "requesterResourceId" UUID,
    "departmentId" UUID,
    "sectionId" UUID,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "workingDays" INTEGER NOT NULL,
    "reason" VARCHAR(2000),
    "status" "VacationRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "managerComment" VARCHAR(4000),
    "reviewedByPrincipalId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vacation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vacation_request_audits" (
    "id" UUID NOT NULL,
    "vacationRequestId" UUID NOT NULL,
    "actorPrincipalId" UUID,
    "action" "VacationAuditAction" NOT NULL,
    "fromStatus" "VacationRequestStatus",
    "toStatus" "VacationRequestStatus",
    "comment" VARCHAR(4000),
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vacation_request_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vacation_requests_organizationId_status_idx" ON "vacation_requests"("organizationId", "status");

-- CreateIndex
CREATE INDEX "vacation_requests_requesterPrincipalId_startDate_idx" ON "vacation_requests"("requesterPrincipalId", "startDate");

-- CreateIndex
CREATE INDEX "vacation_requests_organizationId_startDate_endDate_idx" ON "vacation_requests"("organizationId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "vacation_requests_status_departmentId_idx" ON "vacation_requests"("status", "departmentId");

-- CreateIndex
CREATE INDEX "vacation_request_audits_vacationRequestId_createdAt_idx" ON "vacation_request_audits"("vacationRequestId", "createdAt");

-- AddForeignKey
ALTER TABLE "vacation_requests" ADD CONSTRAINT "vacation_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacation_request_audits" ADD CONSTRAINT "vacation_request_audits_vacationRequestId_fkey" FOREIGN KEY ("vacationRequestId") REFERENCES "vacation_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
