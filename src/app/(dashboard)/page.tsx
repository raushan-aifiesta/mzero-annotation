"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface LSTask {
  id: number;
  data: {
    task_id: string;
    language: string;
    domain: string;
    scenario: string;
    status?: string;
    [key: string]: unknown;
  };
  annotations: any[];
  predictions: any[];
}

function getChoiceValue(results: any[], fromName: string): string | null {
  const r = results.find((r: any) => r.from_name === fromName && r.type === "choices");
  if (!r) return null;
  const choices = r.value?.choices;
  return Array.isArray(choices) ? choices[0] : null;
}

export default function HomePage() {
  const [tasks, setTasks] = useState<LSTask[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [langFilter, setLangFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [drawerTask, setDrawerTask] = useState<LSTask | null>(null);
  const [jsonCopied, setJsonCopied] = useState(false);

  useEffect(() => {
    fetch("/api/export")
      .then((r) => r.json())
      .then((data: LSTask[]) => {
        setTasks(data);
        setLoading(false);
      });
  }, []);

  const languages = [...new Set(tasks.map((t) => t.data.language))];
  const domains = [...new Set(tasks.map((t) => t.data.domain))];

  const getTaskStatus = (t: LSTask): string => {
    // Use status field from task data if available, otherwise derive from annotations
    if (t.data.status) return t.data.status as string;
    return t.annotations.length > 0 ? "submitted" : "pending";
  };

  const filtered = tasks.filter((t) => {
    const status = getTaskStatus(t);
    if (filter === "labeled" && status === "pending") return false;
    if (filter === "unlabeled" && status !== "pending") return false;
    if (filter === "in_progress" && status !== "in_progress") return false;
    if (filter === "submitted" && status !== "submitted") return false;
    if (filter === "reviewed" && status !== "reviewed") return false;
    if (langFilter !== "all" && t.data.language !== langFilter) return false;
    return true;
  });

  const totalTasks = tasks.length;
  const annotated = tasks.filter((t) => getTaskStatus(t) !== "pending").length;
  const inProgressCount = tasks.filter((t) => getTaskStatus(t) === "in_progress").length;
  const submittedCount = tasks.filter((t) => getTaskStatus(t) === "submitted").length;
  const reviewedCount = tasks.filter((t) => getTaskStatus(t) === "reviewed").length;
  const progress = totalTasks > 0 ? Math.round((annotated / totalTasks) * 100) : 0;

  function copyJson() {
    if (!drawerTask) return;
    navigator.clipboard.writeText(JSON.stringify(drawerTask, null, 2));
    setJsonCopied(true);
    setTimeout(() => setJsonCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="p-8 text-[var(--text-secondary)]">Loading tasks...</div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Tata Commotion PoC</h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">
          TTS Evaluation — {totalTasks} tasks across {languages.length} languages, {domains.length} domains
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
          <p className="text-[var(--text-secondary)] text-xs">Total</p>
          <p className="text-2xl font-bold mt-1">{totalTasks}</p>
        </div>
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
          <p className="text-[var(--text-secondary)] text-xs">In Progress</p>
          <p className="text-2xl font-bold mt-1 text-amber-500">{inProgressCount}</p>
        </div>
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
          <p className="text-[var(--text-secondary)] text-xs">Submitted</p>
          <p className="text-2xl font-bold mt-1 text-blue-500">{submittedCount}</p>
        </div>
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
          <p className="text-[var(--text-secondary)] text-xs">Reviewed</p>
          <p className="text-2xl font-bold mt-1 text-[var(--success)]">{reviewedCount}</p>
        </div>
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
          <p className="text-[var(--text-secondary)] text-xs">Progress</p>
          <p className="text-2xl font-bold mt-1">{progress}%</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex gap-1">
          {[
            { key: "all", label: "All" },
            { key: "unlabeled", label: "Pending" },
            { key: "in_progress", label: "In Progress" },
            { key: "submitted", label: "Submitted" },
            { key: "reviewed", label: "Reviewed" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs transition ${
                filter === f.key
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={langFilter}
          onChange={(e) => setLangFilter(e.target.value)}
          className="px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-secondary)] focus:outline-none"
        >
          <option value="all">All Languages</option>
          {languages.map((l) => (
            <option key={l} value={l}>
              {l.charAt(0).toUpperCase() + l.slice(1)}
            </option>
          ))}
        </select>
        <span className="text-xs text-[var(--text-secondary)]">
          Showing {filtered.length} tasks
        </span>

        <Link
          href="/api/export"
          target="_blank"
          className="ml-auto px-3 py-1.5 border border-[var(--border)] rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition"
        >
          Export JSON
        </Link>
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {filtered.map((task) => {
          const hasAnn = task.annotations.length > 0;
          const results = hasAnn ? task.annotations[0].result : [];
          const nat = getChoiceValue(results, "naturalness");
          const emo = getChoiceValue(results, "emotion");
          const clar = getChoiceValue(results, "clarity");

          return (
            <div
              key={task.data.task_id}
              className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-hidden"
            >
              <div className="flex items-center p-4 gap-4">
                {(() => {
                  const status = getTaskStatus(task);
                  if (status === 'reviewed') return (
                    <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-[10px] text-white flex-shrink-0" title="Reviewed">&#10003;&#10003;</span>
                  );
                  if (status === 'submitted') return (
                    <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[10px] text-white flex-shrink-0" title="Submitted">&#10003;</span>
                  );
                  if (status === 'in_progress') return (
                    <span className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center text-[10px] text-white flex-shrink-0" title="In Progress">&#9998;</span>
                  );
                  return (
                    <span className="w-5 h-5 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] flex-shrink-0" title="Pending" />
                  );
                })()}

                <Link
                  href={`/annotate/${task.data.task_id}`}
                  className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent)] transition flex-shrink-0 w-32"
                >
                  {task.data.task_id}
                </Link>

                <div className="flex gap-1.5 flex-1">
                  <span className="px-2 py-0.5 rounded text-[10px] bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                    {task.data.language}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                    {task.data.domain}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                    {task.data.scenario}
                  </span>
                </div>

                {hasAnn && (
                  <div className="flex gap-2 text-[10px] text-[var(--text-secondary)]">
                    {nat && (
                      <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">{nat}</span>
                    )}
                    {emo && (
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">{emo}</span>
                    )}
                    {clar && (
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">{clar}</span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 flex-shrink-0">
                  {hasAnn && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setDrawerTask(drawerTask?.data.task_id === task.data.task_id ? null : task);
                      }}
                      className="px-2 py-1 text-[10px] border border-[var(--border)] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition"
                    >
                      {"{ } JSON"}
                    </button>
                  )}
                  <Link
                    href={`/annotate/${task.data.task_id}`}
                    className="px-3 py-1 text-xs bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition"
                  >
                    {getTaskStatus(task) === 'reviewed' ? "View" : getTaskStatus(task) === 'submitted' ? "Review" : hasAnn ? "Continue" : "Annotate"}
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* JSON Slide-in Drawer */}
      {drawerTask && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setDrawerTask(null)}
          />
          <div className="fixed top-0 right-0 h-full w-[480px] max-w-[90vw] bg-[var(--bg-secondary)] border-l border-[var(--border)] shadow-2xl z-50 flex flex-col animate-slide-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <div>
                <h3 className="text-sm font-bold">Annotation JSON</h3>
                <p className="text-xs text-[var(--text-secondary)]">{drawerTask.data.task_id}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyJson}
                  className="px-3 py-1 text-xs border border-[var(--border)] rounded hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
                >
                  {jsonCopied ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={() => setDrawerTask(null)}
                  className="w-7 h-7 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded hover:bg-[var(--bg-tertiary)] transition"
                >
                  &times;
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <pre className="text-xs font-mono text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                {JSON.stringify(drawerTask, null, 2)}
              </pre>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
