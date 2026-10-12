/**
 * Repair drift when `_prisma_migrations` lists local_login_credentials as
 * applied but the table is missing (P2021 on Access / local login).
 * Idempotent — safe when the table already exists.
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function sanitize(text) {
  return String(text).replace(
    /postgres(ql)?:\/\/[^@\s]+@/gi,
    "postgres://***@",
  );
}

if (!process.env.DATABASE_URL || !process.env.DIRECT_URL) {
  console.log(
    "[ensure-local-login] skipped (DATABASE_URL or DIRECT_URL missing)",
  );
  process.exit(0);
}

if (process.env.VERCEL !== "1" && process.env.FORCE_MIGRATE_DEPLOY !== "1") {
  console.log(
    "[ensure-local-login] skipped (not on Vercel; set FORCE_MIGRATE_DEPLOY=1 to override)",
  );
  process.exit(0);
}

const sql = `
CREATE TABLE IF NOT EXISTS "local_login_credentials" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "local_login_credentials_principalId_key"
  ON "local_login_credentials"("principalId");
CREATE UNIQUE INDEX IF NOT EXISTS "local_login_credentials_username_key"
  ON "local_login_credentials"("username");
CREATE INDEX IF NOT EXISTS "local_login_credentials_disabledAt_idx"
  ON "local_login_credentials"("disabledAt");

DO $$ BEGIN
  ALTER TABLE "local_login_credentials"
    ADD CONSTRAINT "local_login_credentials_principalId_fkey"
    FOREIGN KEY ("principalId") REFERENCES "principals"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
`;

const sqlPath = join(tmpdir(), `ensure-local-login-${process.pid}.sql`);
writeFileSync(sqlPath, sql, "utf8");

console.log("[ensure-local-login] ensuring local_login_credentials table…");
const result = spawnSync(
  "npx",
  ["prisma", "db", "execute", "--file", sqlPath, "--schema", "prisma/schema.prisma"],
  {
    encoding: "utf8",
    env: process.env,
    shell: process.platform === "win32",
  },
);

try {
  unlinkSync(sqlPath);
} catch {
  /* ignore */
}

const out = sanitize(`${result.stdout || ""}${result.stderr || ""}`);
if (out.trim()) process.stdout.write(out.endsWith("\n") ? out : `${out}\n`);

if (result.status !== 0) {
  console.error("[ensure-local-login] failed");
  process.exit(result.status ?? 1);
}

console.log("[ensure-local-login] ok");
