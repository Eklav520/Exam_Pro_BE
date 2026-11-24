import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFound } from "./middleware/not-found.js";
import apiRoutes from "./routes/index.js";

const app = express();

app.set("trust proxy", env.TRUST_PROXY_HOPS);

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/", (_request, response) => {
  response.json({ name: "Exam_Pro API", version: "1.0.0" });
});

app.use("/api/v1", apiRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
