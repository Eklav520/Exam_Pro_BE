import mongoose from "mongoose";
import { questionSchema } from "./question.schema.js";

const examSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subject: { type: String, required: true },
    description: { type: String, default: "" },
    durationMinutes: { type: Number, required: true },
    passPercentage: { type: Number, required: true },
    negativeMarking: { type: Number, required: true },
    status: { type: String, enum: ["draft", "published"], required: true, index: true },
    questions: [questionSchema],
  },
  { timestamps: true },
);

export const Exam = mongoose.model("Exam", examSchema);
