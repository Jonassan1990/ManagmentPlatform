import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import { IdentityService } from "@/modules/identity-access/application/identity-service";
import { prisma } from "@/server/db";
import {
  getAuthEnv,
  getPublicAppUrl,
  isOidcConfigured,
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
  // Lazy: only validate full auth secrets when OIDC is actually configured.
  const authEnv = oidcReady ? getAuthEnv() : null;
  const baseUrl =
    authEnv?.AUTH_URL ??
    authEnv?.APP_URL ??
    getPublicAppUrl() ??
    process.env.AUTH_URL ??
    process.env.APP_URL;

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

  // Placeholder secret allows `next build` without OIDC. Real AUTH_SECRET required
  // when isOidcConfigured() — enforced via getAuthEnv() above.
  const secret =
    authEnv?.AUTH_SECRET ??
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
      async signIn({ account, profile }) {
        if (!account || account.provider !== "oidc" || !authEnv) {
          return false;
        }
        const issuer =
          account.issuer ??
          (typeof profile?.iss === "string" ? profile.iss : null) ??
          authEnv.OIDC_ISSUER;
        const subject =
          account.providerAccountId ??
          (typeof profile?.sub === "string" ? profile.sub : null);
        if (!issuer || !subject) {
          return false;
        }

        const identity = new IdentityService(
          prisma,
          new AuthorizationService(prisma),
          new AuditService(prisma),
        );
        const principal = await identity.resolveOrCreateFromOidc({
          issuer,
          subject,
          email: typeof profile?.email === "string" ? profile.email : null,
          displayName:
            typeof profile?.name === "string"
              ? profile.name
              : typeof profile?.preferred_username === "string"
                ? profile.preferred_username
                : null,
        });
        (account as { principalId?: string }).principalId = principal.id;
        return true;
      },
      async jwt({ token, account, profile }) {
        if (account?.provider === "oidc" && authEnv) {
          const principalId = (account as { principalId?: string }).principalId;
          if (principalId) {
            token.principalId = principalId;
          } else {
            const issuer =
              account.issuer ??
              (typeof profile?.iss === "string" ? profile.iss : null) ??
              authEnv.OIDC_ISSUER;
            const subject = account.providerAccountId;
            if (issuer && subject) {
              const identity = new IdentityService(
                prisma,
                new AuthorizationService(prisma),
                new AuditService(prisma),
              );
              const principal = await identity.resolveOrCreateFromOidc({
                issuer,
                subject,
                email: typeof profile?.email === "string" ? profile.email : null,
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
