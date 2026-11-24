import mongoose from "mongoose";
import { questionSchema } from "../exams/question.schema.js";

const embedded = { _id: false, id: false };

// A list rather than an object keyed by question id, so ids are never used as
// MongoDB field names.
const answerSchema = new mongoose.Schema(
  { questionId: { type: String, required: true }, optionIds: [String] },
  embedded,
);

const gradeSchema = new mongoose.Schema(
  {
    score: Number,
    totalMarks: Number,
    percentage: Number,
    passed: Boolean,
    correct: Number,
    incorrect: Number,
    unanswered: Number,
  },
  embedded,
);

// Copied when the attempt starts, so editing or deleting the exam never affects
// a running attempt or a past result.
const examSnapshotSchema = new mongoose.Schema(
  {
    title: String,
    subject: String,
    passPercentage: Number,
    negativeMarking: Number,
    questions: [questionSchema],
  },
  embedded,
);

const attemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
    exam: { type: examSnapshotSchema, required: true },
    status: { type: String, enum: ["in_progress", "submitted"], default: "in_progress" },
    startedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    submittedAt: Date,
    answers: [answerSchema],
    revision: { type: Number, default: 0 },
    grade: gradeSchema,
  },
  { timestamps: true },
);

attemptSchema.index({ user: 1, status: 1, submittedAt: -1 });
// One unfinished attempt per student and exam, even if "start" is sent twice at once.
attemptSchema.index(
  { user: 1, examId: 1 },
  { unique: true, partialFilterExpression: { status: "in_progress" } },
);

export const Attempt = mongoose.model("Attempt", attemptSchema);
