import "dotenv/config";
import app from "../apps/api/dist/app.js";
import { initializeDatabase } from "../apps/api/dist/services/db.js";

await initializeDatabase();

export default app;
