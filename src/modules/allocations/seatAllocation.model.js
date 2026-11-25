import mongoose from "mongoose";

const seatAllocationSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
    },
    candidateUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rollNo: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    candidateName: {
      type: String,
      required: true,
      trim: true,
    },
    photoUrl: {
      type: String,
      default: "/images/candidate-neha.jpg",
    },
    centreId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Centre",
      required: true,
    },
    terminalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Terminal",
      required: true,
    },
    systemId: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    seatNumber: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["ALLOCATED", "IN_PROGRESS", "SUBMITTED"],
      default: "ALLOCATED",
    },
  },
  { timestamps: true },
);

seatAllocationSchema.index({ examId: 1, candidateUserId: 1 }, { unique: true });
seatAllocationSchema.index({ examId: 1, terminalId: 1 }, { unique: true });

export const SeatAllocation = mongoose.model("SeatAllocation", seatAllocationSchema);
