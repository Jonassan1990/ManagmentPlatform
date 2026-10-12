-- Local username/password logins for test Principals
CREATE TABLE "local_login_credentials" (
    "id" UUID NOT NULL,
    "principalId" UUID NOT NULL,
    "username" VARCHAR(80) NOT NULL,
    "passwordHash" VARCHAR(200) NOT NULL,
    "displayName" VARCHAR(200),
    "createdByPrincipalId" UUID,
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "local_login_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "local_login_credentials_principalId_key" ON "local_login_credentials"("principalId");
CREATE UNIQUE INDEX "local_login_credentials_username_key" ON "local_login_credentials"("username");
CREATE INDEX "local_login_credentials_disabledAt_idx" ON "local_login_credentials"("disabledAt");

ALTER TABLE "local_login_credentials" ADD CONSTRAINT "local_login_credentials_principalId_fkey" FOREIGN KEY ("principalId") REFERENCES "principals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
