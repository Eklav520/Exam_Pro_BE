import app from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { env } from "./config/env.js";

try {
  await connectDatabase();
} catch (error) {
  // Log only the message, so connection details never reach the logs.
  console.error(`MongoDB connection failed: ${error.message}`);
  process.exit(1);
}

const server = app.listen(env.PORT, (error) => {
  // Express 5 reports startup failures (such as a port in use) here.
  if (error) {
    throw error;
  }

  console.log(`Exam_Pro API listening on port ${env.PORT}`);
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);

  // Force the exit if open requests do not finish in time.
  setTimeout(() => process.exit(1), 10_000).unref();

  server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
