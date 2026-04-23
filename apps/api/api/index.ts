import "dotenv/config";
import app from "../dist/app.js";

app.get("/__vercel_probe", (_req, res) => {
  res.status(200).json({ ok: true, probe: "easycite" });
});

export default app;
