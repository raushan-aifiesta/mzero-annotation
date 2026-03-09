"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 h-screen bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col fixed left-0 top-0">
      <div className="p-4 border-b border-[var(--border)]">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-[var(--text-primary)]">AI Fiesta</span>
        </Link>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          Annotation Platform
        </p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        <Link
          href="/"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
            pathname === "/"
              ? "bg-[var(--accent)] text-white"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
          }`}
        >
          <span className="w-5 text-center">~</span>
          <span>Dashboard</span>
        </Link>
        <Link
          href="/api/export"
          target="_blank"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition"
        >
          <span className="w-5 text-center">^</span>
          <span>Export JSON</span>
        </Link>
      </nav>

      <div className="p-3 border-t border-[var(--border)]">
        <p className="text-[10px] text-[var(--text-secondary)] text-center">
          Tata Commotion PoC
        </p>
      </div>
    </aside>
  );
}
