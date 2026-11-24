// Adds a first admin, a student and sample exams. Never changes existing data:
// existing accounts are left alone, and exams are added only when there are none.
import { createInterface } from "node:readline/promises";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { hashPassword } from "../src/modules/auth/password.js";
import { Exam } from "../src/modules/exams/exam.model.js";
import { examSchema } from "../src/modules/exams/exam.validation.js";
import { User } from "../src/modules/users/user.model.js";
import { sampleExams } from "./sample-exams.js";

const MIN_PASSWORD_LENGTH = 8;

const accounts = [
  { role: "admin", name: "Admin", email: "admin@exampro.test" },
  { role: "student", name: "Student", email: "student@exampro.test" },
];

// Uses SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_STUDENT_EMAIL and
// SEED_STUDENT_PASSWORD when set; otherwise asks.
async function ask(variable, prompt, fallback) {
  if (process.env[variable]) {
    return process.env[variable];
  }
  if (!process.stdin.isTTY) {
    throw new Error(`Set ${variable}, or run this in a terminal to be asked for it.`);
  }
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await readline.question(prompt)).trim();
  readline.close();
  return answer || fallback;
}

async function seedAccount({ role, name, email: defaultEmail }) {
  const prefix = `SEED_${role.toUpperCase()}`;
  const email = (
    await ask(`${prefix}_EMAIL`, `${name} email [${defaultEmail}]: `, defaultEmail)
  ).toLowerCase();

  if (await User.exists({ email })) {
    console.log(`Skipped ${email}: the account already exists.`);
    return;
  }

  const password = await ask(`${prefix}_PASSWORD`, `${name} password: `, "");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`The password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  await User.create({ name, email, role, passwordHash: await hashPassword(password) });
  console.log(`Created ${role} ${email}.`);
}

try {
  await connectDatabase();
  for (const account of accounts) {
    await seedAccount(account);
  }
  if (await Exam.exists({})) {
    console.log("Skipped sample exams: there are exams already.");
  } else {
    await Exam.create(sampleExams.map((exam) => examSchema.parse(exam)));
    console.log(`Created ${sampleExams.length} sample exams.`);
  }
} catch (error) {
  console.error(`Seeding stopped: ${error.message}`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
