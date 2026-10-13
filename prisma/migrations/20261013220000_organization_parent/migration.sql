-- An organization can sit inside another, so Q can contain QD, QM, and QC.
ALTER TABLE "organizations" ADD COLUMN "parentOrganizationId" UUID;

CREATE INDEX "organizations_parentOrganizationId_idx" ON "organizations"("parentOrganizationId");

ALTER TABLE "organizations" ADD CONSTRAINT "organizations_parentOrganizationId_fkey" FOREIGN KEY ("parentOrganizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
