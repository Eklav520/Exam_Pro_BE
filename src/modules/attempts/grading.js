const round = (value) => Math.round(value * 100) / 100;

function reviewQuestion(question, selected, negativeMarking) {
  if (selected.length === 0) {
    return { question, selectedOptionIds: [], outcome: "unanswered", marksAwarded: 0 };
  }

  const isCorrect =
    selected.length === question.correctOptionIds.length &&
    question.correctOptionIds.every((id) => selected.includes(id));

  return {
    question,
    selectedOptionIds: selected,
    outcome: isCorrect ? "correct" : "incorrect",
    marksAwarded: isCorrect ? question.marks : round(-question.marks * negativeMarking),
  };
}

// All-or-nothing per question; the total never drops below zero.
export function gradeExam(exam, answers) {
  const selected = new Map(answers.map((answer) => [answer.questionId, answer.optionIds]));
  const review = exam.questions.map((question) =>
    reviewQuestion(question, selected.get(question.id) ?? [], exam.negativeMarking),
  );
  const count = (outcome) => review.filter((item) => item.outcome === outcome).length;
  const totalMarks = round(exam.questions.reduce((sum, question) => sum + question.marks, 0));
  const score = Math.max(0, round(review.reduce((sum, item) => sum + item.marksAwarded, 0)));
  const percentage = totalMarks > 0 ? round((score / totalMarks) * 100) : 0;

  return {
    grade: {
      score,
      totalMarks,
      percentage,
      passed: percentage >= exam.passPercentage,
      correct: count("correct"),
      incorrect: count("incorrect"),
      unanswered: count("unanswered"),
    },
    review,
  };
}

// Keeps only answers that exist in the exam, so stored data is always gradable.
export function cleanAnswers(questions, answers) {
  return questions.flatMap((question) => {
    const chosen = Object.hasOwn(answers, question.id) ? answers[question.id] : [];
    const valid = question.options.map((option) => option.id).filter((id) => chosen.includes(id));
    const optionIds = question.type === "single" ? valid.slice(0, 1) : valid;
    return optionIds.length > 0 ? [{ questionId: question.id, optionIds }] : [];
  });
}
