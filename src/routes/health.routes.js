import { Router } from "express";
import { isDatabaseConnected } from "../config/database.js";

const router = Router();

router.get("/", (_request, response) => {
  response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

router.get("/ready", (_request, response) => {
  const connected = isDatabaseConnected();

  response.status(connected ? 200 : 503).json({
    status: connected ? "ok" : "unavailable",
    database: connected ? "connected" : "disconnected",
  });
});

export default router;
