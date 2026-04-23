import "dotenv/config";
import app from "./app.js";
import { initializeDatabase } from "./services/db.js";
const port = Number(process.env.PORT ?? 8787);

initializeDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`EasyCite API listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database", error);
    process.exit(1);
  });
