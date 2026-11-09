-- CreateEnum
CREATE TYPE "OnboardingItemPhase" AS ENUM ('PREBOARDING', 'FIRST_WEEK', 'FIRST_30_DAYS', 'FEEDBACK');

-- CreateEnum
CREATE TYPE "OnboardingTaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE');

-- AlterEnum
ALTER TYPE "OnboardingAuditAction" ADD VALUE 'TASK_UPDATED';

-- AlterTable
ALTER TABLE "onboarding_checklists"
ADD COLUMN "jobTitle" VARCHAR(200),
ADD COLUMN "departmentLabel" VARCHAR(200),
ADD COLUMN "hiringManagerName" VARCHAR(200),
ADD COLUMN "startDate" DATE;

-- AlterTable
ALTER TABLE "onboarding_checklist_items"
ADD COLUMN "phase" "OnboardingItemPhase",
ADD COLUMN "assigneeLabel" VARCHAR(160),
ADD COLUMN "dueDate" DATE,
ADD COLUMN "taskStatus" "OnboardingTaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN "notes" VARCHAR(2000);
