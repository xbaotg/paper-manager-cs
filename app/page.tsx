"use client";

import { useState, useEffect, useMemo } from "react";
import { Navbar } from "./_components/navbar";
import { Hero } from "./_components/hero";
import { PublicationsTable } from "./_components/publications-table";
import { Statistics } from "./_components/statistics";
import { Footer } from "./_components/footer";
import { type Paper, type Lecturer, countsAsPublication } from "@/lib/data";
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

  // The public homepage is a showcase of real output — count + list only
  // accepted/published papers (the in-review/denied pipeline is hidden, even for
  // signed-in lecturers/admins who would otherwise see their own un-accepted ones).
  const publishedPapers = useMemo(
    () => papers.filter((p) => countsAsPublication(p.submissionStatus)),
    [papers]
  );

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
        <Hero papers={publishedPapers} />
        <PublicationsTable papers={publishedPapers} lecturers={lecturers} />
        <Statistics papers={publishedPapers} />
      </main>
      <Footer />
    </>
  );
}
