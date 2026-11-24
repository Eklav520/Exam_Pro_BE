import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import "../test-support/env.js";
import { startServer } from "../test-support/start-server.js";
import app from "../src/app.js";

let server;

before(async () => {
  server = await startServer(app);
});

after(() => server.close());

test("health endpoint reports the API as available", async () => {
  const response = await fetch(`${server.baseUrl}/api/v1/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
  assert.ok(Number.isNaN(Date.parse(body.timestamp)) === false);
});

test("readiness reports 503 while the database is disconnected", async () => {
  const response = await fetch(`${server.baseUrl}/api/v1/health/ready`);

  assert.equal(response.status, 503);
  assert.equal((await response.json()).database, "disconnected");
});

test("unknown routes return a JSON 404", async () => {
  const response = await fetch(`${server.baseUrl}/api/v1/missing`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.error, "Not Found");
});

test("malformed JSON returns a 400", async () => {
  const response = await fetch(`${server.baseUrl}/api/v1/health`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{bad",
  });

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Request Error");
});

test("CORS allows credentials for a configured origin only", async () => {
  const allowed = await fetch(`${server.baseUrl}/api/v1/health`, {
    headers: { Origin: "http://localhost:5173" },
  });
  const blocked = await fetch(`${server.baseUrl}/api/v1/health`, {
    headers: { Origin: "https://evil.example" },
  });

  assert.equal(allowed.headers.get("access-control-allow-origin"), "http://localhost:5173");
  assert.equal(allowed.headers.get("access-control-allow-credentials"), "true");
  assert.equal(blocked.headers.get("access-control-allow-origin"), null);
});
