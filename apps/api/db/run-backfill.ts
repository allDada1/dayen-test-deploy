import { pool } from "./pool";
import { runBackfills } from "./backfill";

(async () => {
  try {
    await runBackfills();
    console.log("Backfill completed");
    process.exit(0);
  } catch (error) {
    console.error("Backfill failed:", error);
    process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
})();
