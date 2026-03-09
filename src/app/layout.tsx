import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Fiesta — Annotation Platform",
  description: "Data annotation platform for Vision AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
