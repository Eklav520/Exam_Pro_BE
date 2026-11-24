function question(id, text, options, correct, explanation, marks) {
  const optionId = (index) => `${id}-o${index + 1}`;
  return {
    id,
    type: correct.length > 1 ? "multiple" : "single",
    text,
    options: options.map((optionText, index) => ({ id: optionId(index), text: optionText })),
    correctOptionIds: correct.map(optionId),
    marks,
    explanation,
  };
}

export const sampleExams = [
  {
    title: "JavaScript Fundamentals",
    subject: "Programming",
    description: "Types, scope, closures and asynchronous code.",
    durationMinutes: 15,
    passPercentage: 50,
    negativeMarking: 0.25,
    status: "published",
    questions: [
      question(
        "js1",
        "What does typeof null return?",
        ['"null"', '"object"', '"undefined"', '"number"'],
        [1],
        "A long-standing quirk of the language, kept for compatibility.",
        2,
      ),
      question(
        "js2",
        "Which of these values are falsy?",
        ["0", '"0"', "NaN", "[]"],
        [0, 2],
        "Non-empty strings and all objects, including empty arrays, are truthy.",
        2,
      ),
      question(
        "js3",
        "Which keyword declares a block-scoped binding that cannot be reassigned?",
        ["var", "let", "const", "static"],
        [2],
        "const prevents reassignment of the binding, not mutation of the value.",
        2,
      ),
    ],
  },
  {
    title: "Quantitative Aptitude",
    subject: "Aptitude",
    description: "Percentages, averages, and time and work.",
    durationMinutes: 20,
    passPercentage: 60,
    negativeMarking: 0,
    status: "published",
    questions: [
      question("qa1", "What is 15% of 240?", ["24", "30", "36", "40"], [2], "0.15 × 240 = 36.", 1),
      question(
        "qa2",
        "A finishes a job in 6 days and B in 12 days. How long do they take together?",
        ["3 days", "4 days", "5 days", "9 days"],
        [1],
        "1/6 + 1/12 = 1/4 of the job per day.",
        1,
      ),
    ],
  },
];
