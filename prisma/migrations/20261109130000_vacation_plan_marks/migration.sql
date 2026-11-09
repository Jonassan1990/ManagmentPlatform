-- CreateEnum
CREATE TYPE "VacationPlanKind" AS ENUM ('VACATION', 'EDUCATION', 'COMPENSATORY', 'ON_CALL', 'PARENTAL');

-- CreateTable
CREATE TABLE "vacation_plan_marks" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "principalId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "kind" "VacationPlanKind" NOT NULL,
    "createdByPrincipalId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vacation_plan_marks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vacation_plan_marks_departmentId_date_idx" ON "vacation_plan_marks"("departmentId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "vacation_plan_marks_principalId_date_key" ON "vacation_plan_marks"("principalId", "date");

-- AddForeignKey
ALTER TABLE "vacation_plan_marks" ADD CONSTRAINT "vacation_plan_marks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacation_plan_marks" ADD CONSTRAINT "vacation_plan_marks_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
