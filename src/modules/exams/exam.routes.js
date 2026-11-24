import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/authenticate.js";
import { objectIdParam } from "../../middleware/object-id.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./exam.controller.js";
import { examSchema } from "./exam.validation.js";

export const examRoutes = Router();

examRoutes.param("id", objectIdParam("Exam"));
examRoutes.use(authenticate, requireRole("student"));
examRoutes.get("/", controller.list);
examRoutes.get("/:id", controller.get);
examRoutes.post("/:id/attempts", controller.startAttempt);

export const adminExamRoutes = Router();

adminExamRoutes.param("id", objectIdParam("Exam"));
adminExamRoutes.use(authenticate, requireRole("admin"));
adminExamRoutes.get("/", controller.adminList);
adminExamRoutes.post("/", validate({ body: examSchema }), controller.adminCreate);
adminExamRoutes.get("/:id", controller.adminGet);
adminExamRoutes.put("/:id", validate({ body: examSchema }), controller.adminUpdate);
adminExamRoutes.delete("/:id", controller.adminRemove);
