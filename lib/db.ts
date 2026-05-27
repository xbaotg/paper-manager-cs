import fs from "fs/promises";
import path from "path";
import { Paper, Lecturer, SAMPLE_PAPERS, SAMPLE_LECTURERS } from "./data";

export interface DatabaseSchema {
  papers: Paper[];
  lecturers: Lecturer[];
  authorAliases: Record<string, number>;
}

// Allow overriding the datastore location (e.g. a mounted volume in Docker).
const DB_FILE = process.env.DATABASE_FILE
  ? path.resolve(process.env.DATABASE_FILE)
  : path.join(process.cwd(), "database.json");

let cachedDb: DatabaseSchema | null = null;

export async function getDbData(): Promise<DatabaseSchema> {
  if (cachedDb && process.env.NODE_ENV === "production") {
    // Basic memory cache in production
    return cachedDb;
  }
  try {
    const data = await fs.readFile(DB_FILE, "utf-8");
    const parsed = JSON.parse(data) as DatabaseSchema;
    cachedDb = parsed;
    return parsed;
  } catch (error: any) {
    if (error.code === "ENOENT") {
      // Initialize with base data if doesn't exist
      const initial: DatabaseSchema = {
        papers: [...SAMPLE_PAPERS],
        lecturers: [...SAMPLE_LECTURERS],
        authorAliases: {}
      };
      await fs.writeFile(DB_FILE, JSON.stringify(initial, null, 2));
      cachedDb = initial;
      return initial;
    }
    throw error;
  }
}

export async function saveDbData(data: DatabaseSchema): Promise<void> {
  cachedDb = data; // update memory cache immediately
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
}
