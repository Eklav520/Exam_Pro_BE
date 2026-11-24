import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { AppError } from "../utils/app-error.js";

// Creates a limiter for login, register and password-reset routes. Counts are
// kept in memory per process; use a shared store when running several instances.
export function createAuthLimiter({ windowMs = 15 * 60 * 1000, limit = 10, ...options } = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_request, _response, next) => {
      next(new AppError(429, "Too many attempts. Please try again later."));
    },
    ...options,
  });
}

// A whole exam room can share one IP address, so only failures count, and the
// strict limit applies per account. The wider limit stops password spraying.
export function createLoginLimiters() {
  return [
    createAuthLimiter({ limit: 100, skipSuccessfulRequests: true }),
    createAuthLimiter({
      limit: 10,
      skipSuccessfulRequests: true,
      keyGenerator: (request) => {
        const email = String(request.body?.email ?? "").trim().toLowerCase().slice(0, 254);
        return `${ipKeyGenerator(request.ip)}|${email}`;
      },
    }),
  ];
}
