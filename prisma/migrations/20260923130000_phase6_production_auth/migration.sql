-- Phase 6 — Production identity (OIDC ExternalIdentity + secure bootstrap)

-- AlterTable
ALTER TABLE "principals" ADD COLUMN "email" VARCHAR(320);

-- CreateTable
CREATE TABLE "external_identities" (
    "id" UUID NOT NULL,
    "issuer" VARCHAR(500) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "principalId" UUID NOT NULL,
    "emailSnapshot" VARCHAR(320),
    "displayNameSnapshot" VARCHAR(200),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bootstrap_consumptions" (
    "id" UUID NOT NULL,
    "principalId" UUID NOT NULL,
    "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" VARCHAR(500),
    "bootstrapKey" VARCHAR(40) NOT NULL DEFAULT 'default',

    CONSTRAINT "bootstrap_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "external_identities_principalId_idx" ON "external_identities"("principalId");

-- CreateIndex
CREATE UNIQUE INDEX "external_identities_issuer_subject_key" ON "external_identities"("issuer", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "bootstrap_consumptions_bootstrapKey_key" ON "bootstrap_consumptions"("bootstrapKey");

-- AddForeignKey
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_principalId_fkey" FOREIGN KEY ("principalId") REFERENCES "principals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
