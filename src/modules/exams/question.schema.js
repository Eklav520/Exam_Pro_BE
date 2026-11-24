import mongoose from "mongoose";

// Questions and options keep the ids given by the exam editor, so `id` is a real
// field here and Mongoose's `id` virtual is turned off.
const embedded = { _id: false, id: false };

const optionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
  },
  embedded,
);

export const questionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ["single", "multiple"], required: true },
    text: { type: String, required: true },
    options: [optionSchema],
    correctOptionIds: [String],
    marks: { type: Number, required: true },
    explanation: { type: String, default: "" },
  },
  embedded,
);
