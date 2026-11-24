import "dotenv/config";
import { z } from "zod";

const portMessage = "must be an integer between 1 and 65535";

function isExactOrigin(value) {
  return URL.canParse(value) && new URL(value).origin === value;
}

const originList = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
  .pipe(
    z
      .array(
        z.string().refine(isExactOrigin, {
          message: "must be exact origins such as https://example.com (no path or trailing slash)",
        }),
      )
      .min(1, "must list at least one origin"),
  );

const mongoUriMessage =
  "must be a mongodb:// or mongodb+srv:// connection string with the <placeholders> replaced";

// Add a variable here in the same change that starts
// using it, so the app refuses to start without it.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce
    .number(portMessage)
    .int(portMessage)
    .min(1, portMessage)
    .max(65535, portMessage)
    .default(5000),
  CORS_ORIGINS: originList.prefault("http://localhost:5173"),
  MONGODB_URI: z
    .string("is required")
    .regex(/^mongodb(\+srv)?:\/\/[^<>\s]+$/, mongoUriMessage),
  // Atlas connection strings name no database, and MongoDB would then use "test".
  MONGODB_DB_NAME: z.string().min(1).default("exam_pro"),
  JWT_SECRET: z.string("is required").min(32, "must be at least 32 characters"),
  // Must outlast the longest exam (8 hours), or students are signed out midway.
  JWT_EXPIRES_IN_HOURS: z.coerce.number().min(9).max(168).default(12),
  // Number of reverse proxies (Nginx, load balancer) in front of the app.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
});

export function parseEnv(source) {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path[0]}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${details}`);
  }

  // In production the localhost default would silently block the real frontend.
  if (result.data.NODE_ENV === "production" && !source.CORS_ORIGINS) {
    throw new Error("Invalid environment variables:\n  - CORS_ORIGINS: required in production");
  }

  return Object.freeze(result.data);
}

export const env = parseEnv(process.env);
