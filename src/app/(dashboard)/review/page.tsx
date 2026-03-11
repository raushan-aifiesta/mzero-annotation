"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface TaskItem {
  id: string;
  language: string;
  domain: string;
  status: string;
  approved_annotation_id?: string;
  annotation_count?: number;
}

export default function ReviewDashboard() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "needs_approval" | "approved">("all");

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((data: TaskItem[]) => {
        const reviewable = data.filter(
          (t) => t.status === "submitted" || t.status === "reviewed" || t.status === "ready_for_review"
        );
        setTasks(reviewable);
        setLoading(false);
      });
  }, []);

  const filtered = tasks.filter((t) => {
    if (filter === "needs_approval") return !t.approved_annotation_id;
    if (filter === "approved") return !!t.approved_annotation_id;
    return true;
  });

  const approvedCount = tasks.filter((t) => t.approved_annotation_id).length;
  const needsApprovalCount = tasks.length - approvedCount;

  // Find first unapproved task
  const firstUnapproved = tasks.find((t) => !t.approved_annotation_id);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-[var(--text-secondary)]">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">
          Review Dashboard
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              window.location.href = "/api/export?download=1";
            }}
            className="px-4 py-2 text-sm border border-[var(--border)] text-[var(--text-primary)] rounded-lg hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
          >
            Export approved ({approvedCount})
          </button>
          {firstUnapproved && (
            <Link
              href={`/review/${firstUnapproved.id}`}
              className="px-4 py-2 text-sm bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition"
            >
              Start reviewing &rarr;
            </Link>
          )}
        </div>
      </div>

      <p className="text-sm text-[var(--text-secondary)] mb-4">
        {tasks.length} tasks &middot; {approvedCount} approved &middot;{" "}
        {needsApprovalCount} need approval
      </p>

      {/* Progress bar */}
      {tasks.length > 0 && (
        <div className="w-full h-2 bg-[var(--bg-tertiary)] rounded-full mb-6">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${(approvedCount / tasks.length) * 100}%` }}
          />
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {(["all", "needs_approval", "approved"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition ${
              filter === f
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {f === "all"
              ? `All (${tasks.length})`
              : f === "needs_approval"
              ? `Needs Approval (${needsApprovalCount})`
              : `Approved (${approvedCount})`}
          </button>
        ))}
      </div>

      <div className="space-y-1">
        {filtered.map((t) => (
          <Link
            key={t.id}
            href={`/review/${t.id}`}
            className="flex items-center gap-4 px-4 py-3 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] transition"
          >
            <span className="text-sm font-mono text-[var(--text-primary)] w-36 shrink-0">
              {t.id}
            </span>
            <span className="text-xs text-[var(--text-secondary)] w-16">
              {t.language}
            </span>
            <span className="text-xs text-[var(--text-secondary)] w-24">
              {t.domain}
            </span>
            <span className="flex-1" />
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                t.approved_annotation_id
                  ? "bg-green-500/10 text-green-400"
                  : "bg-yellow-500/10 text-yellow-400"
              }`}
            >
              {t.approved_annotation_id ? "Approved" : "Needs approval"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
