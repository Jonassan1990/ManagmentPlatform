import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    APP_URL: z.string().url().optional(),
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
    APP_URL: process.env.APP_URL,
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
}

/** DEV auth is only possible in development with an explicit flag and principal UUID. */
export function isDevAuthEnabled(env: AppEnv = getEnv()): boolean {
  return (
    env.NODE_ENV === "development" &&
    env.ALLOW_DEV_AUTH === true &&
    Boolean(env.DEV_AUTH_PRINCIPAL_ID)
  );
}
