import { verifyToken } from "../modules/auth/token.js";
import { User } from "../modules/users/user.model.js";
import { AppError } from "../utils/app-error.js";

// Loads the user on every request, so a deleted account or changed role takes
// effect immediately rather than when the token expires.
export async function authenticate(request, _response, next) {
  const [scheme, token] = (request.get("authorization") ?? "").split(" ");
  const userId = scheme === "Bearer" && token ? verifyToken(token) : null;
  const user = userId && (await User.findById(userId));

  if (!user) {
    throw new AppError(401, "Please sign in again.");
  }

  request.user = user;
  next();
}

export function requireRole(role) {
  return (request, _response, next) => {
    if (request.user.role !== role) {
      throw new AppError(403, "You do not have access to this.");
    }
    next();
  };
}
