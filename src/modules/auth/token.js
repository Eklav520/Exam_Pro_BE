import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";

export function signToken(userId) {
  return jwt.sign({}, env.JWT_SECRET, {
    algorithm: "HS256",
    subject: String(userId),
    expiresIn: env.JWT_EXPIRES_IN_HOURS * 3600,
  });
}

// Returns the user id, or null when the token is invalid or expired.
export function verifyToken(token) {
  try {
    return jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] }).sub ?? null;
  } catch {
    return null;
  }
}
