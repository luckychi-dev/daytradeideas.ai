import "../env-file.js";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadDatabaseUrl } from "./config.js";
import { createPool } from "./database.js";

const migrationsDir = fileURLToPath(new URL("../../migrations", import.meta.url));
const pool = createPool(loadDatabaseUrl());

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const existing = await pool.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
    if (existing.rowCount) continue;
    const sql = await readFile(new URL(`../../migrations/${file}`, import.meta.url), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.info(`Applied migration ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}
