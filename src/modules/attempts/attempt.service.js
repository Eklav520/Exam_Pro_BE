import { AppError } from "../../utils/app-error.js";
import { Exam } from "../exams/exam.model.js";
import { Attempt } from "./attempt.model.js";
import { cleanAnswers, gradeExam } from "./grading.js";

// Time allowed after the deadline for the browser's automatic submit to arrive.
const SUBMIT_GRACE_MS = 10_000;
const DUPLICATE_KEY = 11000;

const graceCutoff = () => new Date(Date.now() - SUBMIT_GRACE_MS);

function toAttempt(attempt) {
  return {
    id: String(attempt._id),
    examId: String(attempt.examId),
    examTitle: attempt.exam.title,
    status: attempt.status,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    serverTime: new Date(),
    // Listed field by field: the answer key must never reach a candidate.
    questions: attempt.exam.questions.map(({ id, type, text, options, marks }) => ({
      id,
      type,
      text,
      options,
      marks,
    })),
    answers: Object.fromEntries(
      attempt.answers.map(({ questionId, optionIds }) => [questionId, optionIds]),
    ),
    revision: attempt.revision,
  };
}

async function findOwned(attemptId, userId) {
  const attempt = await Attempt.findOne({ _id: attemptId, user: userId }).lean();
  if (!attempt) {
    throw new AppError(404, "Attempt not found.");
  }
  return attempt;
}

// Grades and closes an attempt. Safe to call more than once or concurrently.
async function finalize(attempt) {
  let current = attempt;

  while (current?.status === "in_progress") {
    const { grade } = gradeExam(current.exam, current.answers);
    const submittedAt = new Date(Math.min(Date.now(), current.expiresAt.getTime()));
    // Matching the revision makes sure answers saved meanwhile are graded too.
    const { modifiedCount } = await Attempt.updateOne(
      { _id: current._id, status: "in_progress", revision: current.revision },
      { $set: { status: "submitted", submittedAt, grade } },
    );
    if (modifiedCount === 1) {
      return;
    }
    current = await Attempt.findById(current._id).lean();
  }
}

// Closes attempts left open past their deadline.
export async function closeExpired(userId) {
  const expired = await Attempt.find({
    user: userId,
    status: "in_progress",
    expiresAt: { $lt: graceCutoff() },
  }).lean();
  await Promise.all(expired.map(finalize));
}

// Maps exam id to the id of the student's unfinished attempt.
export async function findActiveAttemptIds(userId) {
  const attempts = await Attempt.find({
    user: userId,
    status: "in_progress",
    expiresAt: { $gt: new Date() },
  })
    .select("examId")
    .lean();
  return new Map(attempts.map((attempt) => [String(attempt.examId), String(attempt._id)]));
}

export async function start(examId, userId) {
  const exam = await Exam.findOne({ _id: examId, status: "published" }).lean();
  if (!exam) {
    throw new AppError(404, "Exam not found.");
  }

  const findOpen = () => Attempt.findOne({ user: userId, examId, status: "in_progress" }).lean();

  const open = await findOpen();
  if (open && open.expiresAt > new Date()) {
    return toAttempt(open);
  }
  if (open) {
    await finalize(open);
  }

  const now = Date.now();
  try {
    const attempt = await Attempt.create({
      user: userId,
      examId,
      exam: {
        title: exam.title,
        subject: exam.subject,
        passPercentage: exam.passPercentage,
        negativeMarking: exam.negativeMarking,
        questions: exam.questions,
      },
      startedAt: now,
      expiresAt: now + exam.durationMinutes * 60_000,
    });
    return toAttempt(attempt.toObject());
  } catch (error) {
    // A simultaneous request created it first.
    const other = error.code === DUPLICATE_KEY && (await findOpen());
    if (!other) {
      throw error;
    }
    return toAttempt(other);
  }
}

export async function get(attemptId, userId) {
  await closeExpired(userId);
  return toAttempt(await findOwned(attemptId, userId));
}

// Stores answers unless the attempt has ended or a newer revision is already saved.
async function storeAnswers(attempt, { answers, revision }) {
  await Attempt.updateOne(
    {
      _id: attempt._id,
      status: "in_progress",
      expiresAt: { $gte: graceCutoff() },
      revision: { $lt: revision },
    },
    { $set: { answers: cleanAnswers(attempt.exam.questions, answers), revision } },
  );
}

export async function saveAnswers(attemptId, userId, payload) {
  const attempt = await findOwned(attemptId, userId);
  await storeAnswers(attempt, payload);

  const current = await findOwned(attemptId, userId);
  if (current.status !== "in_progress" || current.expiresAt < graceCutoff()) {
    throw new AppError(409, "This exam has already ended.");
  }
  return { revision: current.revision };
}

export async function submit(attemptId, userId, payload) {
  const attempt = await findOwned(attemptId, userId);
  await storeAnswers(attempt, payload);
  await finalize(await findOwned(attemptId, userId));
  return { attemptId: String(attempt._id) };
}

function toResultSummary(attempt) {
  return {
    attemptId: String(attempt._id),
    examId: String(attempt.examId),
    examTitle: attempt.exam.title,
    subject: attempt.exam.subject,
    submittedAt: attempt.submittedAt,
    passPercentage: attempt.exam.passPercentage,
    ...attempt.grade,
  };
}

export async function listResults(userId) {
  await closeExpired(userId);
  const attempts = await Attempt.find({ user: userId, status: "submitted" })
    .select("examId exam.title exam.subject exam.passPercentage submittedAt grade")
    .sort({ submittedAt: -1 })
    .lean();
  return attempts.map(toResultSummary);
}

export async function getResult(attemptId, userId) {
  await closeExpired(userId);
  const attempt = await findOwned(attemptId, userId);
  if (attempt.status !== "submitted") {
    throw new AppError(404, "Result not found.");
  }
  return { ...toResultSummary(attempt), review: gradeExam(attempt.exam, attempt.answers).review };
}
