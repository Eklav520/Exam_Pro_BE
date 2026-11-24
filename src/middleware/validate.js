import { AppError } from "../utils/app-error.js";

// Usage: router.post("/", validate({ body: createExamSchema }), controller)
// Parsed values are placed on request.validated, because request.query is
// read-only in Express 5.
export function validate(schemas) {
  return async (request, _response, next) => {
    const validated = {};
    const details = [];

    for (const [source, schema] of Object.entries(schemas)) {
      const result = await schema.safeParseAsync(request[source]);

      if (result.success) {
        validated[source] = result.data;
      } else {
        for (const issue of result.error.issues) {
          details.push({ path: [source, ...issue.path].join("."), message: issue.message });
        }
      }
    }

    if (details.length > 0) {
      throw new AppError(400, "Validation failed.", details);
    }

    request.validated = validated;
    next();
  };
}
