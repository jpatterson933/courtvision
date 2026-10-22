import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CourtVision | Lakers research",
  description:
    "Explore Lakers games, lineups, and player performance with evidence behind every statistic.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
