import { isObjectIdOrHexString } from "mongoose";
import { AppError } from "../utils/app-error.js";

// Usage: router.param("id", objectIdParam("Exam"))
export function objectIdParam(resource) {
  return (_request, _response, next, value) => {
    if (!isObjectIdOrHexString(value)) {
      throw new AppError(404, `${resource} not found.`);
    }
    next();
  };
}
