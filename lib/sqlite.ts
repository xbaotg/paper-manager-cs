import "server-only";
import path from "path";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "./schema";
import { runMigrations } from "./migrate";
import { seedDatabase, ensureBootstrapAdmin } from "./seed";

// Single-file SQLite datastore. Path is configurable for Docker (mounted volume).
const DB_FILE = process.env.DATABASE_FILE
  ? path.resolve(process.env.DATABASE_FILE)
  : path.join(process.cwd(), "app.db");

let db: Database.Database | null = null;

// Lazily open the connection, bootstrap the schema, and seed once.
export function getDb(): Database.Database {
  if (db) return db;

  const instance = new Database(DB_FILE);
  instance.pragma("journal_mode = WAL");
  instance.pragma("foreign_keys = ON");
  instance.exec(SCHEMA_SQL);
  runMigrations(instance);
  seedDatabase(instance);
  ensureBootstrapAdmin(instance);

  db = instance;
  return db;
}
