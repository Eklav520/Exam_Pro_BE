import { Router } from "express";
import { z } from "zod";
import { authenticate, requireRole } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { Terminal } from "../centres/terminal.model.js";
import { User } from "../users/user.model.js";
import { SeatAllocation } from "./seatAllocation.model.js";

const allocationRoutes = Router();
const studentAllocationRoutes = Router();

const autoAssignSchema = z.object({
  examId: z.string().trim().min(1),
  centreId: z.string().trim().optional(),
});

allocationRoutes.post(
  "/auto-assign",
  authenticate,
  requireRole("admin"),
  validate({ body: autoAssignSchema }),
  async (req, res) => {
    const { examId, centreId } = req.validated.body;

    const existingAllocations = await SeatAllocation.find({ examId }).lean();
    const allocatedCandidateIds = new Set(
      existingAllocations.map((a) => String(a.candidateUserId)),
    );
    const allocatedTerminalIds = new Set(
      existingAllocations.map((a) => String(a.terminalId)),
    );

    const students = await User.find({ role: "student" }).sort({ createdAt: 1 }).lean();
    const unallocatedStudents = students.filter(
      (s) => !allocatedCandidateIds.has(String(s._id)),
    );

    const terminalFilter = centreId ? { centreId } : {};
    const terminals = await Terminal.find(terminalFilter)
      .sort({ centreCode: 1, seatNumber: 1 })
      .lean();
    const availableTerminals = terminals.filter(
      (t) => !allocatedTerminalIds.has(String(t._id)),
    );

    const count = Math.min(unallocatedStudents.length, availableTerminals.length);
    const created = [];

    for (let i = 0; i < count; i++) {
      const student = unallocatedStudents[i];
      const terminal = availableTerminals[i];
      const rollNo = `ROLL${1001 + existingAllocations.length + i}`;

      const allocation = await SeatAllocation.create({
        examId,
        candidateUserId: student._id,
        rollNo,
        candidateName: student.name,
        centreId: terminal.centreId,
        terminalId: terminal._id,
        systemId: terminal.systemId,
        seatNumber: terminal.seatNumber,
      });
      created.push(allocation);
    }

    res.status(201).json({
      allocatedCount: created.length,
      allocations: created,
    });
  },
);

studentAllocationRoutes.get(
  "/my-allocation",
  authenticate,
  requireRole("student"),
  async (req, res) => {
    const allocation = await SeatAllocation.findOne({
      candidateUserId: req.user._id,
    })
      .sort({ createdAt: -1 })
      .populate("examId", "title durationMinutes")
      .populate("centreId", "code name address")
      .lean();

    res.json({ allocation: allocation ?? null });
  },
);

export { allocationRoutes, studentAllocationRoutes };
