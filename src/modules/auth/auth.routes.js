import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { createLoginLimiters } from "../../middleware/rate-limit.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./auth.controller.js";
import { loginSchema } from "./auth.validation.js";

const router = Router();

router.post("/login", createLoginLimiters(), validate({ body: loginSchema }), controller.login);
router.get("/me", authenticate, controller.me);

export default router;
