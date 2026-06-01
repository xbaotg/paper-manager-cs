"use client";

import { useState, useEffect } from "react";
import { Navbar } from "./_components/navbar";
import { Hero } from "./_components/hero";
import { PublicationsTable } from "./_components/publications-table";
import { Statistics } from "./_components/statistics";
import { Footer } from "./_components/footer";
import { type Paper, type Lecturer } from "@/lib/data";
import { getDatabase } from "./actions";

export default function Home() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load from Server DB on mount
  useEffect(() => {
    getDatabase().then((db) => {
      setPapers(db.papers);
      setLecturers(db.lecturers);
      setLoaded(true);
    }).catch((err) => {
      console.error(err);
      setPapers([]);
      setLecturers([]);
      setLoaded(true);
    });
  }, []);

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero papers={papers} />
        <PublicationsTable papers={papers} lecturers={lecturers} />
        <Statistics papers={papers} />
      </main>
      <Footer />
    </>
  );
}
