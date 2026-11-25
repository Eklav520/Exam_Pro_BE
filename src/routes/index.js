import { Router } from "express";
import {
  allocationRoutes,
  studentAllocationRoutes,
} from "../modules/allocations/allocation.routes.js";
import { attemptRoutes, resultRoutes } from "../modules/attempts/attempt.routes.js";
import authRoutes from "../modules/auth/auth.routes.js";
import { centreRoutes, terminalRoutes } from "../modules/centres/centre.routes.js";
import { adminExamRoutes, examRoutes } from "../modules/exams/exam.routes.js";
import healthRoutes from "./health.routes.js";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/exams", examRoutes);
router.use("/attempts", attemptRoutes);
router.use("/results", resultRoutes);
router.use("/admin/exams", adminExamRoutes);
router.use("/centres", centreRoutes);
router.use("/terminals", terminalRoutes);
router.use("/allocations", allocationRoutes);
router.use("/student", studentAllocationRoutes);

export default router;
