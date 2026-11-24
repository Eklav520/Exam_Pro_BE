import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import { z } from "zod";
import { errorHandler } from "../src/middleware/error-handler.js";
import { createAuthLimiter } from "../src/middleware/rate-limit.js";
import { validate } from "../src/middleware/validate.js";
import { AppError } from "../src/utils/app-error.js";
import { startServer } from "../test-support/start-server.js";

let server;

before(async () => {
  const app = express();
  app.use(express.json());
  app.get("/async-error", async () => {
    throw new AppError(409, "Already submitted.");
  });
  app.get("/crash", async () => {
    throw new Error("secret database detail");
  });
  app.post("/login", createAuthLimiter({ limit: 2 }), (_request, response) => {
    response.json({ ok: true });
  });
  app.post(
    "/exams",
    validate({
      body: z.object({ title: z.string().min(1) }),
      query: z.object({ page: z.coerce.number().default(1) }),
    }),
    (request, response) => response.json(request.validated),
  );
  app.use(errorHandler);
  server = await startServer(app);
});

after(() => server.close());

function post(path, body) {
  return fetch(`${server.baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("rejected async handlers reach the error handler", async () => {
  const response = await fetch(`${server.baseUrl}/async-error`);

  assert.equal(response.status, 409);
  assert.equal((await response.json()).message, "Already submitted.");
});

test("unexpected errors do not leak their message", async (t) => {
  const log = t.mock.method(console, "error", () => {});
  const response = await fetch(`${server.baseUrl}/crash`);

  assert.equal(response.status, 500);
  assert.doesNotMatch(await response.text(), /secret/);
  assert.equal(log.mock.callCount(), 1);
});

test("auth limiter returns a JSON 429 after the limit", async () => {
  assert.equal((await post("/login", {})).status, 200);
  assert.equal((await post("/login", {})).status, 200);

  const blocked = await post("/login", {});
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).error, "Request Error");
  assert.ok(blocked.headers.get("retry-after"));
});

test("validate passes parsed values and strips unknown fields", async () => {
  const response = await post("/exams?page=3", { title: "Maths", admin: true });

  assert.deepEqual(await response.json(), { body: { title: "Maths" }, query: { page: 3 } });
});

test("validate reports each invalid field", async () => {
  const response = await post("/exams", { title: "" });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.details[0].path, "body.title");
});
