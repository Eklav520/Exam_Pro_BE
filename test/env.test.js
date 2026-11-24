import assert from "node:assert/strict";
import { test } from "node:test";
import "../test-support/env.js";
import { parseEnv } from "../src/config/env.js";

const MONGODB_URI = "mongodb+srv://user:pass@cluster0.example.mongodb.net/?appName=Cluster0";
const JWT_SECRET = "a-secret-that-is-at-least-32-characters";

test("defaults are applied for local development", () => {
  assert.deepEqual(parseEnv({ MONGODB_URI, JWT_SECRET }), {
    NODE_ENV: "development",
    PORT: 5000,
    CORS_ORIGINS: ["http://localhost:5173"],
    MONGODB_URI,
    MONGODB_DB_NAME: "exam_pro",
    JWT_SECRET,
    JWT_EXPIRES_IN_HOURS: 12,
    TRUST_PROXY_HOPS: 0,
  });
});

test("several origins are split and trimmed", () => {
  const { CORS_ORIGINS } = parseEnv({
    MONGODB_URI,
    JWT_SECRET,
    CORS_ORIGINS: "https://a.com, https://b.com",
  });

  assert.deepEqual(CORS_ORIGINS, ["https://a.com", "https://b.com"]);
});

for (const [name, source, expected] of [
  ["out-of-range port", { PORT: "70000" }, /PORT/],
  ["non-numeric port", { PORT: "abc" }, /PORT/],
  ["wildcard origin", { CORS_ORIGINS: "*" }, /CORS_ORIGINS/],
  ["origin with a trailing slash", { CORS_ORIGINS: "https://a.com/" }, /CORS_ORIGINS/],
  ["missing origins in production", { NODE_ENV: "production" }, /CORS_ORIGINS/],
  ["negative proxy hops", { TRUST_PROXY_HOPS: "-1" }, /TRUST_PROXY_HOPS/],
  ["missing MongoDB URI", { MONGODB_URI: undefined }, /MONGODB_URI: is required/],
  ["non-MongoDB URI", { MONGODB_URI: "postgres://localhost" }, /MONGODB_URI/],
  ["missing JWT secret", { JWT_SECRET: undefined }, /JWT_SECRET: is required/],
  ["short JWT secret", { JWT_SECRET: "short" }, /JWT_SECRET/],
  ["token shorter than the longest exam", { JWT_EXPIRES_IN_HOURS: "1" }, /JWT_EXPIRES_IN_HOURS/],
  ["unreplaced placeholder", { MONGODB_URI: "mongodb+srv://u:<db_password>@h" }, /MONGODB_URI/],
]) {
  test(`rejects ${name}`, () => {
    assert.throws(() => parseEnv({ MONGODB_URI, JWT_SECRET, ...source }), expected);
  });
}

test("an invalid MongoDB URI is not echoed in the error", () => {
  assert.throws(
    () => parseEnv({ MONGODB_URI: "mongo://user:hunter2@host" }),
    (error) => !error.message.includes("hunter2"),
  );
});
