-- CreateEnum
CREATE TYPE "VacationDurationKind" AS ENUM ('FULL_DAYS', 'HALF_DAY', 'HOURS');

-- CreateEnum
CREATE TYPE "VacationDayPart" AS ENUM ('MORNING', 'AFTERNOON');

-- AlterTable
ALTER TABLE "vacation_requests"
  ALTER COLUMN "workingDays" TYPE DECIMAL(6,3) USING "workingDays"::decimal(6,3),
  ADD COLUMN "durationKind" "VacationDurationKind" NOT NULL DEFAULT 'FULL_DAYS',
  ADD COLUMN "dayPart" "VacationDayPart",
  ADD COLUMN "hours" DECIMAL(4,1);

-- Existing full-day requests keep their weekday count and gain an hour total.
UPDATE "vacation_requests"
SET "hours" = "workingDays" * 8
WHERE "hours" IS NULL;
