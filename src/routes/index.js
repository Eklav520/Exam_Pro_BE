import { Router } from "express";
import { attemptRoutes, resultRoutes } from "../modules/attempts/attempt.routes.js";
import authRoutes from "../modules/auth/auth.routes.js";
import { adminExamRoutes, examRoutes } from "../modules/exams/exam.routes.js";
import healthRoutes from "./health.routes.js";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/exams", examRoutes);
router.use("/attempts", attemptRoutes);
router.use("/results", resultRoutes);
router.use("/admin/exams", adminExamRoutes);

export default router;
