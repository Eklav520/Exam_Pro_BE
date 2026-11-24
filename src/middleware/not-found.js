export function notFound(request, response) {
  response.status(404).json({
    error: "Not Found",
    message: `Route ${request.method} ${request.originalUrl} was not found.`,
  });
}
