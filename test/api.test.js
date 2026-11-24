import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import "../test-support/env.js";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { startServer } from "../test-support/start-server.js";
import { sampleExams } from "../scripts/sample-exams.js";
import app from "../src/app.js";
import { Attempt } from "../src/modules/attempts/attempt.model.js";
import { hashPassword } from "../src/modules/auth/password.js";
import { signToken } from "../src/modules/auth/token.js";
import { Exam } from "../src/modules/exams/exam.model.js";
import { User } from "../src/modules/users/user.model.js";

let mongo;
let server;
let student;
let other;
let admin;
let exam;
let passwordHash;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: "exam_pro_test" });
  await Promise.all([User.init(), Exam.init(), Attempt.init()]);
  passwordHash = await hashPassword("correct-password");
  server = await startServer(app);
});

after(async () => {
  await server?.close();
  await mongoose.disconnect();
  await mongo?.stop();
});

beforeEach(async () => {
  await Promise.all([User.deleteMany(), Exam.deleteMany(), Attempt.deleteMany()]);
  const create = async (name, role) => {
    const user = await User.create({ name, email: `${name}@exampro.test`, role, passwordHash });
    return { id: user.id, token: signToken(user.id) };
  };
  student = await create("student", "student");
  other = await create("other", "student");
  admin = await create("admin", "admin");
  exam = (await Exam.create(sampleExams[0])).toObject();
});

async function call(method, path, { as, body, token = as?.token } = {}) {
  const response = await fetch(`${server.baseUrl}/api/v1${path}`, {
    method,
    headers: {
      ...(body && { "Content-Type": "application/json" }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body && JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null, text };
}

const startExam = async (as = student) =>
  (await call("POST", `/exams/${exam._id}/attempts`, { as })).body;

describe("auth", () => {
  const login = (email, password) => call("POST", "/auth/login", { body: { email, password } });

  test("signs in with any email casing and identifies the user without the hash", async () => {
    const { status, body } = await login(" Student@ExamPro.test ", "correct-password");
    assert.equal(status, 200);

    const me = await call("GET", "/auth/me", { token: body.token });
    assert.deepEqual(me.body, {
      id: student.id,
      name: "student",
      email: "student@exampro.test",
      role: "student",
    });
  });

  test("gives the same answer for a wrong password and an unknown email", async () => {
    const wrong = await login("student@exampro.test", "nope");
    const unknown = await login("nobody@exampro.test", "nope");
    assert.equal(wrong.status, 401);
    assert.deepEqual(wrong.body, unknown.body);
  });

  test("rejects operators in place of strings", async () => {
    const { status } = await call("POST", "/auth/login", {
      body: { email: { $gt: "" }, password: { $gt: "" } },
    });
    assert.equal(status, 400);
  });

  test("limits failures per account without blocking others on the same address", async () => {
    for (let i = 0; i < 10; i += 1) {
      await login("other@exampro.test", "nope");
    }
    assert.equal((await login("other@exampro.test", "correct-password")).status, 429);
    assert.equal((await login("admin@exampro.test", "correct-password")).status, 200);
  });

  test("rejects missing, forged, unsigned and expired tokens", async () => {
    const payload = { sub: student.id };
    const tokens = [
      undefined,
      "garbage",
      jwt.sign(payload, "a-different-secret-of-at-least-32-chars"),
      jwt.sign(payload, "", { algorithm: "none" }),
      jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: -1 }),
    ];
    for (const token of tokens) {
      assert.equal((await call("GET", "/auth/me", { token })).status, 401);
    }
  });

  test("a deleted user's token stops working", async () => {
    await User.findByIdAndDelete(student.id);
    assert.equal((await call("GET", "/auth/me", { as: student })).status, 401);
  });
});

describe("access control", () => {
  test("enforces roles", async () => {
    const asStudent = { as: student };
    assert.equal((await call("GET", "/admin/exams", asStudent)).status, 403);
    assert.equal((await call("DELETE", `/admin/exams/${exam._id}`, asStudent)).status, 403);
    assert.equal((await call("GET", "/exams", { as: admin })).status, 403);
    assert.equal((await call("GET", "/exams")).status, 401);
  });

  test("a student cannot reach another student's attempt or result", async () => {
    const attempt = await startExam(student);
    const body = { answers: {}, revision: 1 };
    const as = other;
    assert.equal((await call("GET", `/attempts/${attempt.id}`, { as })).status, 404);
    assert.equal((await call("PUT", `/attempts/${attempt.id}/answers`, { as, body })).status, 404);
    assert.equal((await call("POST", `/attempts/${attempt.id}/submit`, { as, body })).status, 404);
    await call("POST", `/attempts/${attempt.id}/submit`, { as: student, body });
    assert.equal((await call("GET", `/results/${attempt.id}`, { as })).status, 404);
    assert.deepEqual((await call("GET", "/results", { as })).body, []);
  });

  test("malformed ids are a 404", async () => {
    assert.equal((await call("GET", "/exams/nope", { as: student })).status, 404);
  });
});

describe("exams for students", () => {
  test("lists published exams only, without questions", async () => {
    await Exam.create({ ...sampleExams[1], status: "draft" });
    const { body, text } = await call("GET", "/exams", { as: student });
    assert.equal(body.length, 1);
    assert.equal(body[0].questionCount, 3);
    assert.equal(body[0].totalMarks, 6);
    assert.equal(body[0].activeAttemptId, null);
    assert.doesNotMatch(text, /correctOptionIds|explanation|typeof/);
  });

  test("drafts cannot be opened or started", async () => {
    const draft = await Exam.create({ ...sampleExams[1], status: "draft" });
    assert.equal((await call("GET", `/exams/${draft.id}`, { as: student })).status, 404);
    const start = await call("POST", `/exams/${draft.id}/attempts`, { as: student });
    assert.equal(start.status, 404);
  });
});

describe("attempts", () => {
  const save = (id, revision, answers) =>
    call("PUT", `/attempts/${id}/answers`, { as: student, body: { revision, answers } });
  const submit = (id, revision, answers) =>
    call("POST", `/attempts/${id}/submit`, { as: student, body: { revision, answers } });
  const expire = (id, msAgo) =>
    Attempt.updateOne({ _id: id }, { expiresAt: new Date(Date.now() - msAgo) });

  test("never sends the answer key before submission", async () => {
    const started = await call("POST", `/exams/${exam._id}/attempts`, { as: student });
    const loaded = await call("GET", `/attempts/${started.body.id}`, { as: student });
    assert.equal(loaded.body.questions.length, 3);
    assert.doesNotMatch(started.text + loaded.text, /correctOptionIds|explanation/);
    assert.equal((await call("GET", `/results/${started.body.id}`, { as: student })).status, 404);
  });

  test("starting again resumes, even when requests arrive together", async () => {
    const attempts = await Promise.all([1, 2, 3, 4, 5].map(() => startExam()));
    assert.equal(new Set(attempts.map((attempt) => attempt.id)).size, 1);
    assert.equal(await Attempt.countDocuments(), 1);
    const { body } = await call("GET", `/exams/${exam._id}`, { as: student });
    assert.equal(body.activeAttemptId, attempts[0].id);
  });

  test("ignores an out-of-order save", async () => {
    const { id } = await startExam();
    await save(id, 2, { js1: ["js1-o2"] });
    assert.deepEqual((await save(id, 1, { js1: ["js1-o1"] })).body, { revision: 2 });
    const { body } = await call("GET", `/attempts/${id}`, { as: student });
    assert.deepEqual(body.answers, { js1: ["js1-o2"] });
  });

  test("drops answers that do not belong to the exam", async () => {
    const { id } = await startExam();
    await save(id, 1, {
      js1: ["js1-o2", "js1-o1"],
      js2: ["js2-o1", "js2-o1", "bogus"],
      unknown: ["x"],
    });
    const { body } = await call("GET", `/attempts/${id}`, { as: student });
    assert.deepEqual(body.answers, { js1: ["js1-o1"], js2: ["js2-o1"] });
  });

  test("grades on submit, with negative marking, and reveals the review", async () => {
    const { id } = await startExam();
    await submit(id, 1, { js1: ["js1-o2"], js2: ["js2-o1"] });
    const { body } = await call("GET", `/results/${id}`, { as: student });
    assert.equal(body.score, 1.5);
    assert.equal(body.percentage, 25);
    assert.equal(body.passed, false);
    assert.deepEqual([body.correct, body.incorrect, body.unanswered], [1, 1, 1]);
    assert.deepEqual(body.review[0].question.correctOptionIds, ["js1-o2"]);
    const list = await call("GET", "/results", { as: student });
    assert.doesNotMatch(list.text, /review|correctOptionIds/);
    assert.equal(list.body[0].score, 1.5);
  });

  test("submitting twice keeps the first result, and later saves are refused", async () => {
    const { id } = await startExam();
    await submit(id, 1, { js1: ["js1-o1"] });
    assert.equal((await submit(id, 2, { js1: ["js1-o2"] })).status, 200);
    assert.equal((await save(id, 3, { js1: ["js1-o2"] })).status, 409);
    assert.equal((await call("GET", `/results/${id}`, { as: student })).body.correct, 0);
  });

  test("accepts the automatic submit just after the deadline", async () => {
    const { id } = await startExam();
    await expire(id, 2_000);
    await submit(id, 1, { js1: ["js1-o2"] });
    assert.equal((await call("GET", `/results/${id}`, { as: student })).body.correct, 1);
  });

  test("ignores answers sent long after the deadline but grades saved ones", async () => {
    const { id } = await startExam();
    await save(id, 1, { js1: ["js1-o2"] });
    await expire(id, 60_000);
    assert.equal((await save(id, 2, { js1: ["js1-o1"] })).status, 409);
    await submit(id, 3, { js1: ["js1-o1"] });
    assert.equal((await call("GET", `/results/${id}`, { as: student })).body.correct, 1);
  });

  test("closes an abandoned attempt and allows a new one", async () => {
    const { id } = await startExam();
    await expire(id, 60_000);
    assert.equal((await call("GET", "/results", { as: student })).body[0].attemptId, id);
    const { body } = await call("GET", `/attempts/${id}`, { as: student });
    assert.equal(body.status, "submitted");
    assert.notEqual((await startExam()).id, id);
  });

  test("editing or deleting the exam does not affect a running attempt", async () => {
    const { id } = await startExam();
    await Exam.updateOne({ _id: exam._id }, { $set: { "questions.0.correctOptionIds": ["js1-o1"] } });
    await call("DELETE", `/admin/exams/${exam._id}`, { as: admin });
    await submit(id, 1, { js1: ["js1-o2"] });
    assert.equal((await call("GET", `/results/${id}`, { as: student })).body.correct, 1);
  });
});

describe("managing exams", () => {
  const input = () => structuredClone(sampleExams[1]);

  test("creates, reads, updates and deletes", async () => {
    const created = await call("POST", "/admin/exams", { as: admin, body: input() });
    assert.equal(created.status, 201);
    const url = `/admin/exams/${created.body.id}`;

    const loaded = await call("GET", url, { as: admin });
    assert.deepEqual(loaded.body, { id: created.body.id, ...input() });

    const body = { ...input(), title: "Renamed" };
    assert.equal((await call("PUT", url, { as: admin, body })).body.title, "Renamed");
    assert.equal((await call("GET", "/admin/exams", { as: admin })).body.length, 2);

    assert.equal((await call("DELETE", url, { as: admin })).status, 204);
    assert.equal((await call("GET", url, { as: admin })).status, 404);
    assert.equal((await call("PUT", url, { as: admin, body })).status, 404);
  });

  test("rejects invalid exams", async () => {
    const invalid = [
      (exam) => (exam.questions = []),
      (exam) => (exam.questions[0].correctOptionIds = ["missing"]),
      (exam) => (exam.questions[0].correctOptionIds = ["qa1-o1", "qa1-o2"]),
      (exam) => (exam.questions[1].id = exam.questions[0].id),
      (exam) => (exam.questions[0].options[1].id = exam.questions[0].options[0].id),
      (exam) => (exam.questions[0].marks = 0),
      (exam) => (exam.durationMinutes = 0),
    ];
    for (const change of invalid) {
      const body = input();
      change(body);
      const { status } = await call("POST", "/admin/exams", { as: admin, body });
      assert.equal(status, 400, change.toString());
    }
  });
});
