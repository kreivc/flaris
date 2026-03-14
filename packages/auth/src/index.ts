import { db } from "@flaris/db";
import * as schema from "@flaris/db/schema/auth";
import { env } from "@flaris/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";

const trustedOrigins = env.CORS_ORIGIN.split(",");

const getDomain = () => {
  try {
    const url = new URL(env.BETTER_AUTH_URL);
    const hostname = url.hostname;
    const firstDot = hostname.indexOf(".");
    if (firstDot !== -1) {
      return hostname.slice(firstDot);
    }
    return "";
  } catch {
    return "";
  }
};

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: schema,
  }),
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: true,
    minPasswordLength: 6,
    maxPasswordLength: 32,
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  session: {
    cookieCache: {
      enabled: false,
    },
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    storeSessionInDatabase: true,
  },
  plugins: [admin()],
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
      httpOnly: true,
    },
    crossSubDomainCookies: {
      enabled: env.NODE_ENV === "production", // disable on localhost
      domain: getDomain(),
    },
    ipAddress: {
      ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
    },
  },
  secondaryStorage: {
    get: async (key) => {
      const value = await env.KV.get(key);
      return value;
    },
    set: async (key, value, ttl) => {
      if (ttl) {
        await env.KV.put(key, value, { expirationTtl: ttl });
      } else {
        await env.KV.put(key, value);
      }
    },
    delete: async (key) => {
      await env.KV.delete(key);
    },
  },
  rateLimit: {
    storage: "secondary-storage",
  },
});
