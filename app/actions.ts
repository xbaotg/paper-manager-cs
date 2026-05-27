"use server";

import { getDbData, saveDbData, type DatabaseSchema } from "@/lib/db";
import type { Paper, Lecturer } from "@/lib/data";

export async function getDatabase(): Promise<DatabaseSchema> {
  return await getDbData();
}

export async function addPaperServer(paper: Paper): Promise<DatabaseSchema> {
  const db = await getDbData();
  db.papers = [paper, ...db.papers];
  await saveDbData(db);
  return db;
}

export async function updatePaperServer(id: number, updatedPaper: Paper): Promise<DatabaseSchema> {
  const db = await getDbData();
  db.papers = db.papers.map(p => p.id === id ? updatedPaper : p);
  await saveDbData(db);
  return db;
}

export async function deletePaperServer(id: number): Promise<DatabaseSchema> {
  const db = await getDbData();
  db.papers = db.papers.filter(p => p.id !== id);
  await saveDbData(db);
  return db;
}

export async function addLecturerServer(lecturer: Lecturer): Promise<DatabaseSchema> {
  const db = await getDbData();
  db.lecturers = [lecturer, ...db.lecturers];
  await saveDbData(db);
  return db;
}

export async function updateLecturerServer(id: number, updatedLecturer: Lecturer): Promise<DatabaseSchema> {
  const db = await getDbData();
  db.lecturers = db.lecturers.map(l => l.id === id ? updatedLecturer : l);
  await saveDbData(db);
  return db;
}

export async function deleteLecturerServer(id: number): Promise<DatabaseSchema> {
  const db = await getDbData();
  db.lecturers = db.lecturers.filter(l => l.id !== id);
  await saveDbData(db);
  return db;
}

export async function saveAuthorAliasServer(rawName: string, lecturerId: number): Promise<DatabaseSchema> {
  const db = await getDbData();
  db.authorAliases[rawName] = lecturerId;
  await saveDbData(db);
  return db;
}
