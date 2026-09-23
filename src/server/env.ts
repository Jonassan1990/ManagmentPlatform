import { z } from "zod";

/**
 * Base env validated at runtime for most app paths.
 * OIDC / AUTH_SECRET are intentionally NOT required here so `next build`
 * and Vercel can succeed without production IdP secrets present at build time.
 */
const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    DIRECT_URL: z.string().min(1).optional(),
    APP_URL: z.string().url().optional(),
    AUTH_URL: z.string().url().optional(),
    ALLOW_DEV_AUTH: z
      .string()
      .optional()
      .transform((v) => v === "true" || v === "1"),
    DEV_AUTH_PRINCIPAL_ID: z.string().uuid().optional().or(z.literal("")),
    DEV_AUTH_DISPLAY_NAME: z.string().max(200).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.NODE_ENV === "production" && val.ALLOW_DEV_AUTH) {
      ctx.addIssue({
        code: "custom",
        message:
          "ALLOW_DEV_AUTH cannot be enabled when NODE_ENV=production",
        path: ["ALLOW_DEV_AUTH"],
      });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL || undefined,
    APP_URL: process.env.APP_URL,
    AUTH_URL: process.env.AUTH_URL,
    ALLOW_DEV_AUTH: process.env.ALLOW_DEV_AUTH,
    DEV_AUTH_PRINCIPAL_ID: process.env.DEV_AUTH_PRINCIPAL_ID || undefined,
    DEV_AUTH_DISPLAY_NAME: process.env.DEV_AUTH_DISPLAY_NAME,
  });
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${message}`);
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvCacheForTests(): void {
  cached = null;
  cachedAuth = null;
}

/** DEV auth is only possible in development with an explicit flag and principal UUID. */
export function isDevAuthEnabled(env: AppEnv = getEnv()): boolean {
  return (
    env.NODE_ENV === "development" &&
    env.ALLOW_DEV_AUTH === true &&
    Boolean(env.DEV_AUTH_PRINCIPAL_ID)
  );
}

/** True when issuer + client id + client secret are present (lazy; safe at build). */
export function isOidcConfigured(): boolean {
  return Boolean(
    process.env.OIDC_ISSUER?.trim() &&
      process.env.OIDC_CLIENT_ID?.trim() &&
      process.env.OIDC_CLIENT_SECRET?.trim(),
  );
}

const authEnvSchema = z.object({
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 characters"),
  AUTH_URL: z.string().url().optional(),
  APP_URL: z.string().url().optional(),
  OIDC_ISSUER: z.string().url(),
  OIDC_CLIENT_ID: z.string().min(1),
  OIDC_CLIENT_SECRET: z.string().min(1),
  OIDC_SCOPES: z.string().default("openid profile email"),
  BOOTSTRAP_SETUP_TOKEN: z.string().min(16).optional(),
});

export type AuthEnv = z.infer<typeof authEnvSchema>;

let cachedAuth: AuthEnv | null = null;

/**
 * Runtime-only auth config. Call from auth routes / session resolution — not at module load
 * during `next build`. Throws if OIDC is incomplete or AUTH_SECRET missing when OIDC is set.
 */
export function getAuthEnv(): AuthEnv {
  if (cachedAuth) return cachedAuth;
  if (!isOidcConfigured()) {
    throw new Error(
      "OIDC is not configured. Set OIDC_ISSUER, OIDC_CLIENT_ID, and OIDC_CLIENT_SECRET.",
    );
  }
  const parsed = authEnvSchema.safeParse({
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL || undefined,
    APP_URL: process.env.APP_URL || undefined,
    OIDC_ISSUER: process.env.OIDC_ISSUER,
    OIDC_CLIENT_ID: process.env.OIDC_CLIENT_ID,
    OIDC_CLIENT_SECRET: process.env.OIDC_CLIENT_SECRET,
    OIDC_SCOPES: process.env.OIDC_SCOPES || "openid profile email",
    BOOTSTRAP_SETUP_TOKEN: process.env.BOOTSTRAP_SETUP_TOKEN || undefined,
  });
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid auth environment configuration: ${message}`);
  }
  cachedAuth = parsed.data;
  return cachedAuth;
}

/** Soft peek at bootstrap token without requiring full OIDC (for setup UI hints). */
export function getBootstrapSetupToken(): string | null {
  const token = process.env.BOOTSTRAP_SETUP_TOKEN?.trim();
  return token && token.length >= 16 ? token : null;
}

export function getPublicAppUrl(env: AppEnv = getEnv()): string | undefined {
  return env.AUTH_URL ?? env.APP_URL;
}
