import { z } from "zod";

const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "must be a short identifier");
const text = (max) => z.string().trim().min(1).max(max);
const isUnique = (values) => new Set(values).size === values.length;

const questionSchema = z
  .object({
    id,
    type: z.enum(["single", "multiple"]),
    text: text(5000),
    options: z
      .array(z.object({ id, text: text(1000) }))
      .min(2)
      .max(20)
      .refine((options) => isUnique(options.map((option) => option.id)), "ids must be unique"),
    correctOptionIds: z.array(id).min(1).refine(isUnique, "must be unique"),
    marks: z.number().positive().max(1000),
    explanation: z.string().trim().max(5000),
  })
  .refine(
    ({ options, correctOptionIds }) =>
      correctOptionIds.every((correct) => options.some((option) => option.id === correct)),
    { path: ["correctOptionIds"], message: "must be among the options" },
  )
  .refine(({ type, correctOptionIds }) => type === "multiple" || correctOptionIds.length === 1, {
    path: ["correctOptionIds"],
    message: "a single-answer question has one correct option",
  });

export const examSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    subject: text(100),
    description: z.string().trim().max(2000),
    durationMinutes: z.number().int().min(1).max(480),
    passPercentage: z.number().min(0).max(100),
    negativeMarking: z.number().min(0).max(1),
    status: z.enum(["draft", "published"]),
    questions: z
      .array(questionSchema)
      .max(500)
      .refine((questions) => isUnique(questions.map((question) => question.id)), {
        message: "ids must be unique",
      }),
  })
  .refine((exam) => exam.status === "draft" || exam.questions.length > 0, {
    path: ["questions"],
    message: "add at least one question before publishing",
  });
