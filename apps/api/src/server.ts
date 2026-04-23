import cors from "cors";
import "dotenv/config";
import express from "express";
import { documentsRouter } from "./routes/documents.js";
import { searchRouter } from "./routes/search.js";

const app = express();
const port = Number(process.env.PORT ?? 8787);

app.use(cors({ origin: process.env.CORS_ORIGIN ?? "*" }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "citepilot-api" });
});

app.use("/api/search", searchRouter);
app.use("/api/documents", documentsRouter);

app.listen(port, () => {
  console.log(`EasyCite API listening on http://localhost:${port}`);
});
