import { pool } from "./pool";
import { migrate } from "./migrate";

(async () => {
  try {
    await migrate();
    console.log("Migration completed");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
})();
