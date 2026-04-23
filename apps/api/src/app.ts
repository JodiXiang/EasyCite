import cors from "cors";
import express from "express";
import { documentsRouter } from "./routes/documents.js";
import { searchRouter } from "./routes/search.js";

export const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN ?? "*" }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "easycite-api" });
});

app.use("/api/search", searchRouter);
app.use("/api/documents", documentsRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled request error", error);
  res.status(500).json({
    ok: false,
    error: error instanceof Error ? error.message : "Unknown server error"
  });
});

export default app;
