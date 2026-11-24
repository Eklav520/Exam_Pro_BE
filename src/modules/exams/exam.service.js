import { AppError } from "../../utils/app-error.js";
import { findActiveAttemptIds } from "../attempts/attempt.service.js";
import { Exam } from "./exam.model.js";

// Everything a list needs, without loading questions or the answer key.
const SUMMARY_FIELDS =
  "title subject description durationMinutes passPercentage negativeMarking status questions.marks";

function base(exam) {
  return {
    id: String(exam._id),
    title: exam.title,
    subject: exam.subject,
    description: exam.description,
    durationMinutes: exam.durationMinutes,
    passPercentage: exam.passPercentage,
    negativeMarking: exam.negativeMarking,
    status: exam.status,
  };
}

function toSummary(exam) {
  return {
    ...base(exam),
    questionCount: exam.questions.length,
    totalMarks: exam.questions.reduce((sum, question) => sum + question.marks, 0),
  };
}

const toFullExam = (exam) => ({ ...base(exam), questions: exam.questions });

function found(exam) {
  if (!exam) {
    throw new AppError(404, "Exam not found.");
  }
  return exam;
}

// Students

export async function listForStudent(userId) {
  const [exams, active] = await Promise.all([
    Exam.find({ status: "published" }).select(SUMMARY_FIELDS).sort({ createdAt: -1 }).lean(),
    findActiveAttemptIds(userId),
  ]);
  return exams.map((exam) => ({
    ...toSummary(exam),
    activeAttemptId: active.get(String(exam._id)) ?? null,
  }));
}

export async function getForStudent(examId, userId) {
  const [exam, active] = await Promise.all([
    Exam.findOne({ _id: examId, status: "published" }).select(SUMMARY_FIELDS).lean(),
    findActiveAttemptIds(userId),
  ]);
  return { ...toSummary(found(exam)), activeAttemptId: active.get(examId.toLowerCase()) ?? null };
}

// Admins

export async function listForAdmin() {
  const exams = await Exam.find().select(SUMMARY_FIELDS).sort({ createdAt: -1 }).lean();
  return exams.map(toSummary);
}

export async function getForAdmin(examId) {
  return toFullExam(found(await Exam.findById(examId).lean()));
}

export async function create(input) {
  const exam = await Exam.create(input);
  return toFullExam(exam.toObject());
}

export async function update(examId, input) {
  const exam = await Exam.findByIdAndUpdate(examId, { $set: input }, { new: true }).lean();
  return toFullExam(found(exam));
}

// Attempts keep their own copy of the exam, so past results are unaffected.
export async function remove(examId) {
  found(await Exam.findByIdAndDelete(examId));
}
