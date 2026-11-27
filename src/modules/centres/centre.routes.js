import { Router } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { authenticate, requireRole } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { AppError } from "../../utils/app-error.js";
import { SeatAllocation } from "../allocations/seatAllocation.model.js";
import { Centre } from "./centre.model.js";
import {
  bulkImportCentresSchema,
  bulkImportTerminalsSchema,
  heartbeatSchema,
  normalizeMac,
  registerTerminalSchema,
  upsertCentreSchema,
  verifyAndBindSchema,
} from "./centre.validation.js";
import { Terminal } from "./terminal.model.js";

const centreRoutes = Router();
const terminalRoutes = Router();

centreRoutes.get("/", authenticate, requireRole("admin"), async (_req, res) => {
  const centres = await Centre.find().sort({ code: 1 }).lean();
  const counts = await Terminal.aggregate([
    { $group: { _id: "$centreId", terminalCount: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.terminalCount]));

  res.json({
    centres: centres.map((c) => ({
      ...c,
      terminalCount: countMap.get(String(c._id)) ?? 0,
    })),
  });
});

centreRoutes.post(
  "/",
  authenticate,
  requireRole("admin"),
  validate({ body: upsertCentreSchema }),
  async (req, res) => {
    const data = req.validated.body;
    const centre = await Centre.findOneAndUpdate(
      { code: data.code },
      { $set: data },
      { new: true, upsert: true, runValidators: true },
    );
    res.status(201).json({ centre });
  },
);

centreRoutes.post(
  "/bulk-import",
  authenticate,
  requireRole("admin"),
  validate({ body: bulkImportCentresSchema }),
  async (req, res) => {
    const { rows } = req.validated.body;
    let inserted = 0;
    let updated = 0;
    const failed = [];

    for (let i = 0; i < rows.length; i++) {
      const parsed = upsertCentreSchema.safeParse(rows[i]);
      if (!parsed.success) {
        failed.push({
          row: i + 1,
          reason: parsed.error.issues.map((iss) => `${iss.path.join(".")}: ${iss.message}`).join("; "),
        });
        continue;
      }

      const existing = await Centre.findOne({ code: parsed.data.code });
      if (existing) {
        Object.assign(existing, parsed.data);
        await existing.save();
        updated++;
      } else {
        await Centre.create(parsed.data);
        inserted++;
      }
    }

    res.json({ inserted, updated, failed });
  },
);

terminalRoutes.get("/", authenticate, requireRole("admin"), async (req, res) => {
  const filter = {};
  if (typeof req.query.centreId === "string" && req.query.centreId) {
    filter.centreId = req.query.centreId;
  }
  if (typeof req.query.status === "string" && req.query.status) {
    filter.status = req.query.status;
  }
  const terminals = await Terminal.find(filter).sort({ centreCode: 1, seatNumber: 1 }).lean();
  res.json({ terminals });
});

terminalRoutes.post(
  "/register",
  authenticate,
  requireRole("admin"),
  validate({ body: registerTerminalSchema }),
  async (req, res) => {
    const { centreCode, centreName, seatNumber, systemId, ipv4Address, macAddress } =
      req.validated.body;

    let centre = await Centre.findOne({ code: centreCode });
    if (!centre) {
      centre = await Centre.create({
        code: centreCode,
        name: centreName || centreCode,
      });
    }

    const terminal = await Terminal.findOneAndUpdate(
      { systemId },
      {
        $set: {
          centreId: centre._id,
          centreCode,
          seatNumber,
          systemId,
          ipv4Address,
          macAddress,
        },
      },
      { new: true, upsert: true, runValidators: true },
    );

    res.status(201).json({ terminal });
  },
);

terminalRoutes.post(
  "/bulk-import",
  authenticate,
  requireRole("admin"),
  validate({ body: bulkImportTerminalsSchema }),
  async (req, res) => {
    const { rows } = req.validated.body;
    let inserted = 0;
    let updated = 0;
    const failed = [];

    for (let i = 0; i < rows.length; i++) {
      const parsed = registerTerminalSchema.safeParse(rows[i]);
      if (!parsed.success) {
        failed.push({
          row: i + 1,
          reason: parsed.error.issues.map((iss) => `${iss.path.join(".")}: ${iss.message}`).join("; "),
        });
        continue;
      }

      const { centreCode, centreName, seatNumber, systemId, ipv4Address, macAddress } = parsed.data;
      let centre = await Centre.findOne({ code: centreCode });
      if (!centre) {
        centre = await Centre.create({ code: centreCode, name: centreName || centreCode });
      }

      const existing = await Terminal.findOne({ systemId });
      if (existing) {
        existing.centreId = centre._id;
        existing.centreCode = centreCode;
        existing.seatNumber = seatNumber;
        existing.ipv4Address = ipv4Address;
        existing.macAddress = macAddress;
        await existing.save();
        updated++;
      } else {
        await Terminal.create({
          centreId: centre._id,
          centreCode,
          seatNumber,
          systemId,
          ipv4Address,
          macAddress,
        });
        inserted++;
      }
    }

    res.json({ inserted, updated, failed });
  },
);

// Public/Kiosk Hardware Gate
terminalRoutes.post(
  "/verify-and-bind",
  validate({ body: verifyAndBindSchema }),
  async (req, res) => {
    const { macAddresses, ipv4Address, hardwareFingerprint } = req.validated.body;
    const normalizedMacs = macAddresses.map(normalizeMac);

    const terminal = await Terminal.findOne({
      macAddress: { $in: normalizedMacs },
      ipv4Address,
    });

    if (!terminal) {
      return res.status(403).json({
        code: "UNAUTHORIZED_SYSTEM",
        message: "Terminal MAC/IPv4 is not registered.",
        detectedMacs: normalizedMacs,
        detectedIpv4: ipv4Address,
      });
    }

    if (hardwareFingerprint && !terminal.hardwareFingerprint) {
      terminal.hardwareFingerprint = hardwareFingerprint;
    }
    terminal.status = "ONLINE";
    terminal.lastHeartbeatAt = new Date();
    await terminal.save();

    const allocation = await SeatAllocation.findOne({
      terminalId: terminal._id,
      status: { $in: ["ALLOCATED", "IN_PROGRESS"] },
    })
      .populate("examId", "title durationMinutes")
      .populate("centreId", "code name address")
      .lean();

    const terminalToken = jwt.sign(
      {
        type: "terminal",
        systemId: terminal.systemId,
        terminalId: String(terminal._id),
      },
      env.JWT_SECRET,
      { algorithm: "HS256", subject: String(terminal._id), expiresIn: "6h" },
    );

    return res.json({
      terminalToken,
      terminal,
      allocation: allocation ?? null,
    });
  },
);

terminalRoutes.post(
  "/heartbeat",
  validate({ body: heartbeatSchema }),
  async (req, res) => {
    const { systemId, status, focusViolations } = req.validated.body;
    const terminal = await Terminal.findOneAndUpdate(
      { systemId },
      {
        $set: { status, lastHeartbeatAt: new Date() },
        $inc: { focusViolations },
      },
      { new: true },
    );

    if (!terminal) {
      throw new AppError(404, `Terminal ${systemId} not found.`);
    }

    res.json({ ok: true, terminal });
  },
);

export { centreRoutes, terminalRoutes };
