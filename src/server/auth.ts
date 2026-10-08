import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import { IdentityService } from "@/modules/identity-access/application/identity-service";
import { verifyTempAuthCredentials } from "@/modules/identity-access/application/temp-auth-credentials";
import { TEMP_AUTH_PROVIDER_ID } from "@/modules/identity-access/application/temp-auth-constants";
import { prisma } from "@/server/db";
import {
  getAuthEnv,
  getTempAuthEnv,
  isOidcConfigured,
  resolveAuthSecret,
} from "@/server/env";

declare module "next-auth" {
  interface Session {
    principalId?: string;
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      principalId?: string;
    };
  }

  interface User {
    principalId?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    principalId?: string;
  }
}

function buildAuthConfig(): NextAuthConfig {
  const oidcReady = isOidcConfigured();
  const tempConfig = getTempAuthEnv();
  const authEnv = oidcReady ? getAuthEnv() : null;
  const baseUrl =
    authEnv?.AUTH_URL ??
    authEnv?.APP_URL ??
    tempConfig
      ? process.env.AUTH_URL || process.env.APP_URL
      : process.env.AUTH_URL || process.env.APP_URL;

  const providers: NextAuthConfig["providers"] = [];

  if (authEnv) {
    providers.push({
      id: "oidc",
      name: "OIDC",
      type: "oidc",
      issuer: authEnv.OIDC_ISSUER,
      clientId: authEnv.OIDC_CLIENT_ID,
      clientSecret: authEnv.OIDC_CLIENT_SECRET,
      authorization: {
        params: { scope: authEnv.OIDC_SCOPES },
      },
      profile(profile) {
        return {
          id: String(profile.sub),
          name:
            typeof profile.name === "string"
              ? profile.name
              : typeof profile.preferred_username === "string"
                ? profile.preferred_username
                : null,
          email: typeof profile.email === "string" ? profile.email : null,
        };
      },
    });
  }

  if (tempConfig) {
    providers.push(
      Credentials({
        id: TEMP_AUTH_PROVIDER_ID,
        name: "Temporary owner access",
        credentials: {
          username: { label: "Username", type: "text" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          const username =
            typeof credentials?.username === "string"
              ? credentials.username
              : "";
          const password =
            typeof credentials?.password === "string"
              ? credentials.password
              : "";

          const ok = await verifyTempAuthCredentials({
            username,
            password,
            config: tempConfig,
          });
          if (!ok) {
            return null;
          }

          const identity = new IdentityService(
            prisma,
            new AuthorizationService(prisma),
            new AuditService(prisma),
          );
          try {
            const principal = await identity.resolveOrCreateFromTempAuth({
              principalId: tempConfig.TEMP_AUTH_PRINCIPAL_ID,
              username: tempConfig.TEMP_AUTH_USERNAME,
              displayName:
                tempConfig.TEMP_AUTH_DISPLAY_NAME ?? "Platform Owner",
            });
            return {
              id: principal.id,
              name: principal.displayName,
              principalId: principal.id,
            };
          } catch (error) {
            console.error(
              "[temp-auth] identity resolution failed (fail closed)",
            );
            void error;
            return null;
          }
        },
      }),
    );
  }

  // Placeholder allows `next build` without auth secrets. Real secret required
  // when OIDC and/or temp auth is configured (resolveAuthSecret).
  const secret =
    resolveAuthSecret() ??
    process.env.AUTH_SECRET ??
    "phase6-build-placeholder-secret-do-not-use";

  return {
    providers,
    secret,
    trustHost: true,
    ...(baseUrl ? { basePath: "/api/auth" } : {}),
    session: {
      strategy: "jwt",
      maxAge: 60 * 60 * 8, // 8 hours
    },
    cookies: {
      sessionToken: {
        name:
          process.env.NODE_ENV === "production"
            ? "__Secure-authjs.session-token"
            : "authjs.session-token",
        options: {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure: process.env.NODE_ENV === "production",
        },
      },
    },
    pages: {
      signIn: "/login",
      error: "/login",
    },
    callbacks: {
      async signIn({ account, profile, user }) {
        if (!account) return false;
        if (account.provider === TEMP_AUTH_PROVIDER_ID) {
          return Boolean(
            (user as { principalId?: string } | undefined)?.principalId ||
              user?.id,
          );
        }
        if (account.provider !== "oidc" || !authEnv) {
          return false;
        }
        const issuerRaw =
          account.issuer ??
          (typeof profile?.iss === "string" ? profile.iss : null) ??
          authEnv.OIDC_ISSUER;
        const subjectRaw =
          account.providerAccountId ??
          (typeof profile?.sub === "string" ? profile.sub : null);
        if (
          typeof issuerRaw !== "string" ||
          !issuerRaw ||
          typeof subjectRaw !== "string" ||
          !subjectRaw
        ) {
          return false;
        }

        const identity = new IdentityService(
          prisma,
          new AuthorizationService(prisma),
          new AuditService(prisma),
        );
        const preferred =
          profile &&
          "preferred_username" in profile &&
          typeof (profile as { preferred_username?: unknown })
            .preferred_username === "string"
            ? (profile as { preferred_username: string }).preferred_username
            : null;
        const principal = await identity.resolveOrCreateFromOidc({
          issuer: issuerRaw,
          subject: subjectRaw,
          email: typeof profile?.email === "string" ? profile.email : null,
          displayName:
            typeof profile?.name === "string" ? profile.name : preferred,
        });
        (account as { principalId?: string }).principalId = principal.id;
        return true;
      },
      async jwt({ token, account, profile, user }) {
        if (account?.provider === TEMP_AUTH_PROVIDER_ID) {
          const principalId =
            (user as { principalId?: string } | undefined)?.principalId ??
            user?.id;
          if (principalId) {
            token.principalId = principalId;
          }
          return token;
        }

        if (account?.provider === "oidc" && authEnv) {
          const principalId = (account as { principalId?: string }).principalId;
          if (principalId) {
            token.principalId = principalId;
          } else {
            const issuerRaw =
              account.issuer ??
              (typeof profile?.iss === "string" ? profile.iss : null) ??
              authEnv.OIDC_ISSUER;
            const subjectRaw = account.providerAccountId;
            if (
              typeof issuerRaw === "string" &&
              issuerRaw &&
              typeof subjectRaw === "string" &&
              subjectRaw
            ) {
              const identity = new IdentityService(
                prisma,
                new AuthorizationService(prisma),
                new AuditService(prisma),
              );
              const principal = await identity.resolveOrCreateFromOidc({
                issuer: issuerRaw,
                subject: subjectRaw,
                email:
                  typeof profile?.email === "string" ? profile.email : null,
                displayName:
                  typeof profile?.name === "string" ? profile.name : null,
              });
              token.principalId = principal.id;
            }
          }
        }
        // JWT carries principalId only — never role bindings (re-checked server-side).
        return token;
      },
      async session({ session, token }) {
        if (token.principalId) {
          session.principalId = token.principalId;
          session.user.principalId = token.principalId;
        }
        return session;
      },
    },
  };
}

/**
 * Lazy NextAuth init so importing this module during `next build` does not
 * require OIDC secrets. Handlers/auth resolve config on first use.
 */
function createAuth() {
  return NextAuth(buildAuthConfig());
}

const nextAuth = createAuth();

export const handlers = nextAuth.handlers;
export const auth = nextAuth.auth;
export const signIn = nextAuth.signIn;
export const signOut = nextAuth.signOut;
