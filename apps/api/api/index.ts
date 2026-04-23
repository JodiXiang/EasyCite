import "dotenv/config";
import app from "../src/app.js";

app.get("/__vercel_probe", (_req, res) => {
  res.status(200).json({ ok: true, probe: "easycite" });
});

export default app;
