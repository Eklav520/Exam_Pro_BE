import { AppError } from "../utils/app-error.js";

export function errorHandler(error, _request, response, next) {
  // Part of the response has already gone out, so let Express close the connection.
  if (response.headersSent) {
    return next(error);
  }

  const statusCode = Number.isInteger(error.statusCode) &&
    error.statusCode >= 400 &&
    error.statusCode <= 599
    ? error.statusCode
    : 500;

  if (statusCode >= 500) {
    console.error(error);
  }

  const body = {
    error: statusCode === 500 ? "Internal Server Error" : "Request Error",
    message: statusCode === 500 ? "An unexpected error occurred." : error.message,
  };

  if (statusCode !== 500 && error instanceof AppError && error.details) {
    body.details = error.details;
  }

  response.status(statusCode).json(body);
}
