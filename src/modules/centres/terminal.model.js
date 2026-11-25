import mongoose from "mongoose";

const terminalSchema = new mongoose.Schema(
  {
    centreId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Centre",
      required: true,
    },
    centreCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    systemId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    seatNumber: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    ipv4Address: {
      type: String,
      required: true,
      trim: true,
    },
    macAddress: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    hardwareFingerprint: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["ONLINE", "IDLE", "FAULT", "IN_EXAM"],
      default: "IDLE",
    },
    lastHeartbeatAt: {
      type: Date,
      default: null,
    },
    focusViolations: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

export const Terminal = mongoose.model("Terminal", terminalSchema);
