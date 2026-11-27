import { Router } from "express";
import { z } from "zod";
import { authenticate, requireRole } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { Centre } from "../centres/centre.model.js";
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

    const terminalFilter = { status: { $ne: "FAULT" }, isBuffer: { $ne: true } };
    if (centreId) terminalFilter.centreId = centreId;
    const terminals = await Terminal.find(terminalFilter)
      .sort({ centreCode: 1, seatNumber: 1 })
      .lean();
    const availableByCentre = new Map();
    const allAvailable = [];
    for (const t of terminals) {
      if (allocatedTerminalIds.has(String(t._id))) continue;
      const cid = String(t.centreId);
      if (!availableByCentre.has(cid)) availableByCentre.set(cid, []);
      availableByCentre.get(cid).push(t);
      allAvailable.push(t);
    }

    const toInsert = [];
    const spilloverPool = [];
    let priority1Count = 0;
    let priority2Count = 0;
    let priority3Count = 0;
    let spilloverCount = 0;
    let rollSeq = 1001 + existingAllocations.length;

    for (const student of unallocatedStudents) {
      const prefs = (student.centrePreferences ?? []).sort((a, b) => a.priority - b.priority);
      let assigned = null;
      let matchedPriority = 0;

      for (const pref of prefs) {
        const list = availableByCentre.get(String(pref.centreId));
        if (list && list.length > 0) {
          assigned = list.shift();
          matchedPriority = pref.priority;
          break;
        }
      }

      if (assigned) {
        if (matchedPriority === 1) priority1Count++;
        else if (matchedPriority === 2) priority2Count++;
        else if (matchedPriority === 3) priority3Count++;
        toInsert.push({
          examId,
          candidateUserId: student._id,
          rollNo: `ROLL${rollSeq++}`,
          candidateName: student.name,
          centreId: assigned.centreId,
          terminalId: assigned._id,
          systemId: assigned.systemId,
          seatNumber: assigned.seatNumber,
        });
      } else {
        spilloverPool.push(student);
      }
    }

    const usedTerminalIds = new Set(toInsert.map((a) => String(a.terminalId)));
    const remainingTerminals = allAvailable.filter((t) => !usedTerminalIds.has(String(t._id)));

    const unallocatedStudentsFinal = [];
    for (const student of spilloverPool) {
      const fallback = remainingTerminals.shift();
      if (fallback) {
        spilloverCount++;
        toInsert.push({
          examId,
          candidateUserId: student._id,
          rollNo: `ROLL${rollSeq++}`,
          candidateName: student.name,
          centreId: fallback.centreId,
          terminalId: fallback._id,
          systemId: fallback.systemId,
          seatNumber: fallback.seatNumber,
        });
      } else {
        unallocatedStudentsFinal.push(student.name);
      }
    }

    const created = toInsert.length > 0 ? await SeatAllocation.insertMany(toInsert, { ordered: false }) : [];

    res.status(201).json({
      allocatedCount: created.length,
      priority1Count,
      priority2Count,
      priority3Count,
      spilloverCount,
      unallocatedCount: unallocatedStudentsFinal.length,
      anomalies:
        unallocatedStudentsFinal.length > 0
          ? [`${unallocatedStudentsFinal.length} student(s) unallocated due to full capacity.`]
          : [],
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

studentAllocationRoutes.get(
  "/centres",
  authenticate,
  requireRole("student"),
  async (_req, res) => {
    const centres = await Centre.find({ isActive: true }).sort({ name: 1 }).lean();
    res.json({ centres });
  },
);

studentAllocationRoutes.get(
  "/centre-preferences",
  authenticate,
  requireRole("student"),
  async (req, res) => {
    res.json({ preferences: req.user.centrePreferences ?? [] });
  },
);

const preferencesSchema = z.object({
  centreIds: z.array(z.string().trim().min(1)).length(3, "Select exactly 3 centres"),
});

studentAllocationRoutes.put(
  "/centre-preferences",
  authenticate,
  requireRole("student"),
  validate({ body: preferencesSchema }),
  async (req, res) => {
    const { centreIds } = req.validated.body;
    if (new Set(centreIds).size !== 3) {
      return res.status(400).json({ message: "Please select 3 different centres." });
    }
    const centres = await Centre.find({ _id: { $in: centreIds }, isActive: true }).lean();
    const byId = new Map(centres.map((c) => [String(c._id), c]));
    const preferences = centreIds
      .map((id, idx) => {
        const c = byId.get(id);
        return c
          ? { priority: idx + 1, centreId: c._id, centreCode: c.code, centreName: c.name }
          : null;
      })
      .filter(Boolean);

    if (preferences.length !== 3) {
      return res.status(400).json({ message: "One or more selected centres are invalid." });
    }

    req.user.centrePreferences = preferences;
    await req.user.save();
    return res.json({ preferences });
  },
);

export { allocationRoutes, studentAllocationRoutes };
