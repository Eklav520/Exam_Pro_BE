import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/authenticate.js";
import { objectIdParam } from "../../middleware/object-id.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./attempt.controller.js";
import { answersSchema } from "./attempt.validation.js";

export const attemptRoutes = Router();

attemptRoutes.param("id", objectIdParam("Attempt"));
attemptRoutes.use(authenticate, requireRole("student"));
attemptRoutes.get("/:id", controller.get);
attemptRoutes.put("/:id/answers", validate({ body: answersSchema }), controller.saveAnswers);
attemptRoutes.post("/:id/submit", validate({ body: answersSchema }), controller.submit);

export const resultRoutes = Router();

resultRoutes.param("id", objectIdParam("Result"));
resultRoutes.use(authenticate, requireRole("student"));
resultRoutes.get("/", controller.listResults);
resultRoutes.get("/:id", controller.getResult);
