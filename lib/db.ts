import "server-only";
import { listPapers } from "./queries/papers";
import { listLecturers } from "./queries/lecturers";
import { listAliases } from "./queries/aliases";
import type { Paper, Lecturer } from "./data";

// Back-compat shape consumed by existing client pages via the getDatabase() action.
export interface DatabaseSchema {
  papers: Paper[];
  lecturers: Lecturer[];
  authorAliases: Record<string, number>;
}

// Assemble the legacy JSON-style snapshot from SQLite.
export function readDatabase(): DatabaseSchema {
  return {
    papers: listPapers(),
    lecturers: listLecturers(),
    authorAliases: listAliases(),
  };
}
