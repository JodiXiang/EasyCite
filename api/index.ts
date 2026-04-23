import "dotenv/config";
import app from "../apps/api/src/app.js";
import { initializeDatabase } from "../apps/api/src/services/db.js";

await initializeDatabase();

export default app;
