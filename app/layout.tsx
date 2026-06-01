import type { Metadata } from "next";
import { Inter, Inconsolata } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// WF Visual Sans substitutes (per DESIGN.md): Inter for display/body, Inconsolata for mono.
const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-sans",
});

const inconsolata = Inconsolata({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "CS Research Hub — Hệ thống Quản lý Công bố Khoa học",
  description:
    "Hệ thống quản lý và thống kê bài báo khoa học của Khoa Khoa học máy tính. Nhập thông tin, theo dõi và tổng hợp danh sách công bố khoa học.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`h-full antialiased ${inter.variable} ${inconsolata.variable}`}>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
