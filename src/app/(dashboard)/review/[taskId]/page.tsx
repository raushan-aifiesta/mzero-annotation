"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import type { LocalTask, LocalAnnotation, PronError } from "@/lib/local-store";

interface TaskData {
  task: LocalTask;
  annotations: LocalAnnotation[];
}

interface TaskListItem {
  id: string;
  status: string;
  approved_annotation_id?: string;
}

const RATING_FIELDS = [
  { key: "naturalness", label: "Naturalness" },
  { key: "emotion", label: "Emotion" },
  { key: "speaker_consistency", label: "Speaker Consistency" },
  { key: "audio_clarity", label: "Audio Clarity" },
  { key: "number_pronunciation", label: "Number Pronunciation" },
] as const;

function getCommentKey(field: string): string {
  if (field === "speaker_consistency") return "consistency_comment";
  if (field === "audio_clarity") return "clarity_comment";
  if (field === "number_pronunciation") return "number_comment";
  return `${field}_comment`;
}

function compareAnnotations(a: LocalAnnotation, b: LocalAnnotation) {
  const diffs: string[] = [];
  const matches: string[] = [];

  for (const { key, label } of RATING_FIELDS) {
    const valA = (a as unknown as Record<string, unknown>)[key] as string;
    const valB = (b as unknown as Record<string, unknown>)[key] as string;
    if (valA === valB) matches.push(label);
    else diffs.push(label);
  }

  const issuesA = JSON.stringify([...a.issues].sort());
  const issuesB = JSON.stringify([...b.issues].sort());
  if (issuesA === issuesB) matches.push("issues");
  else diffs.push("issues");

  if (a.pron_errors.length === b.pron_errors.length) matches.push("pron_errors");
  else diffs.push("pron_errors");

  const total = matches.length + diffs.length;
  return { matches, diffs, total, matchCount: matches.length };
}

function AnnotationCard({
  annotation,
  label,
  agentTranscript,
  isApproved,
  onApprove,
  approving,
}: {
  annotation: LocalAnnotation;
  label: string;
  agentTranscript: string;
  isApproved: boolean;
  onApprove: () => void;
  approving: boolean;
}) {
  return (
    <div
      className={`flex-1 border rounded-xl p-5 ${
        isApproved
          ? "border-green-500 bg-green-500/5"
          : "border-[var(--border)]"
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-[var(--text-primary)]">{label}</h3>
          <p className="text-xs text-[var(--text-secondary)]">
            {annotation.annotator_id || "unknown"}
          </p>
        </div>
        {isApproved && (
          <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full">
            Approved
          </span>
        )}
      </div>

      {RATING_FIELDS.map(({ key, label: fieldLabel }) => {
        const value = (annotation as unknown as Record<string, unknown>)[key] as string;
        const commentKey = getCommentKey(key);
        const comment = (annotation as unknown as Record<string, unknown>)[commentKey] as string;
        return (
          <div key={key} className="flex items-baseline gap-2 mb-2">
            <span className="text-xs text-[var(--text-secondary)] w-40 shrink-0">
              {fieldLabel}
            </span>
            <span className="text-sm font-medium text-green-400">
              {value || "\u2014"}
            </span>
            {comment && (
              <span className="text-xs text-[var(--text-secondary)] italic ml-2">
                {comment}
              </span>
            )}
          </div>
        );
      })}

      <div className="mt-4">
        <p className="text-xs text-[var(--text-secondary)] mb-1">
          Agent transcript (errors highlighted):
        </p>
        <div className="text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] rounded-lg p-3">
          <HighlightedTranscript
            text={agentTranscript}
            errors={annotation.pron_errors}
          />
        </div>
        {annotation.pron_errors.length > 0 && (
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            {annotation.pron_errors.length} pronunciation error(s)
          </p>
        )}
      </div>

      <div className="mt-3">
        <span className="text-xs text-[var(--text-secondary)]">Issues: </span>
        {annotation.issues.length > 0 ? (
          annotation.issues.map((issue) => (
            <span
              key={issue}
              className="inline-block text-xs px-2 py-0.5 mr-1 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
            >
              {issue}
            </span>
          ))
        ) : (
          <span className="text-xs text-green-400">No issues</span>
        )}
      </div>

      {annotation.notes && (
        <div className="mt-2">
          <span className="text-xs text-[var(--text-secondary)]">Notes: </span>
          <span className="text-xs text-[var(--text-primary)]">
            {annotation.notes}
          </span>
        </div>
      )}

      <button
        onClick={onApprove}
        disabled={approving || isApproved}
        className={`mt-4 w-full py-2.5 rounded-lg text-sm font-medium transition ${
          isApproved
            ? "bg-green-500/20 text-green-400 cursor-default"
            : "border border-[var(--border)] text-[var(--text-primary)] hover:border-green-500 hover:text-green-400"
        }`}
      >
        {isApproved
          ? "Approved"
          : approving
          ? "Approving..."
          : `Accept ${label}'s version`}
      </button>
    </div>
  );
}

function HighlightedTranscript({
  text,
  errors,
}: {
  text: string;
  errors: PronError[];
}) {
  if (errors.length === 0) return <span>{text}</span>;

  const sorted = [...errors].sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const err of sorted) {
    if (err.start > cursor) {
      parts.push(text.slice(cursor, err.start));
    }
    parts.push(
      <span
        key={`${err.start}-${err.end}`}
        className="bg-red-500/20 text-red-400 rounded px-0.5"
        title={`${err.label}: ${err.correction || "no correction"}`}
      >
        {text.slice(err.start, err.end)}
      </span>
    );
    cursor = err.end;
  }
  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }
  return <>{parts}</>;
}

export default function ReviewTaskPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const router = useRouter();
  const [data, setData] = useState<TaskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Task list for sequential navigation
  const [allTasks, setAllTasks] = useState<TaskListItem[]>([]);

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((tasks: TaskListItem[]) => {
        // Only reviewable tasks (submitted or reviewed)
        const reviewable = tasks.filter(
          (t) => t.status === "submitted" || t.status === "reviewed" || t.status === "ready_for_review"
        );
        setAllTasks(reviewable);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/tasks/${taskId}?all=1`)
      .then((r) => r.json())
      .then((d: TaskData) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [taskId]);

  const currentIdx = useMemo(
    () => allTasks.findIndex((t) => t.id === taskId),
    [allTasks, taskId]
  );

  const prevTaskId = currentIdx > 0 ? allTasks[currentIdx - 1].id : null;
  const nextTaskId = currentIdx >= 0 && currentIdx < allTasks.length - 1
    ? allTasks[currentIdx + 1].id
    : null;

  // Find next unapproved task (from current position forward, wrapping)
  const nextUnapprovedId = useMemo(() => {
    if (allTasks.length === 0) return null;
    const start = currentIdx >= 0 ? currentIdx + 1 : 0;
    for (let i = start; i < allTasks.length; i++) {
      if (!allTasks[i].approved_annotation_id) return allTasks[i].id;
    }
    // Wrap around
    for (let i = 0; i < start && i < allTasks.length; i++) {
      if (!allTasks[i].approved_annotation_id) return allTasks[i].id;
    }
    return null;
  }, [allTasks, currentIdx]);

  const approvedCount = allTasks.filter((t) => t.approved_annotation_id).length;

  const handleApprove = useCallback(
    async (annotatorId: string) => {
      setApproving(true);
      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approved_annotation_id: annotatorId }),
        });
        if (!res.ok) throw new Error("Failed to approve");

        // Update local state
        setData((prev) =>
          prev
            ? {
                ...prev,
                task: {
                  ...prev.task,
                  status: "reviewed",
                  approved_annotation_id: annotatorId,
                },
              }
            : prev
        );

        // Update task list to reflect approval
        setAllTasks((prev) => {
          const updated = prev.map((t) =>
            t.id === taskId
              ? { ...t, approved_annotation_id: annotatorId, status: "reviewed" }
              : t
          );

          // Auto-navigate to next unapproved task after a short delay
          const start = updated.findIndex((t) => t.id === taskId);
          let nextId: string | null = null;
          for (let i = start + 1; i < updated.length; i++) {
            if (!updated[i].approved_annotation_id) { nextId = updated[i].id; break; }
          }
          if (!nextId) {
            for (let i = 0; i < start; i++) {
              if (!updated[i].approved_annotation_id) { nextId = updated[i].id; break; }
            }
          }
          if (nextId) {
            const dest = nextId;
            setTimeout(() => router.push(`/review/${dest}`), 600);
          }

          return updated;
        });
      } catch (e) {
        alert("Failed: " + (e instanceof Error ? e.message : "Unknown"));
      } finally {
        setApproving(false);
      }
    },
    [taskId, router]
  );

  const navigateTo = useCallback(
    (id: string) => {
      router.push(`/review/${id}`);
    },
    [router]
  );

  // Keyboard shortcuts: left/right arrow for prev/next, n for next unapproved
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft" && prevTaskId) navigateTo(prevTaskId);
      if (e.key === "ArrowRight" && nextTaskId) navigateTo(nextTaskId);
      if (e.key === "n" && nextUnapprovedId) navigateTo(nextUnapprovedId);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prevTaskId, nextTaskId, nextUnapprovedId, navigateTo]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen text-[var(--text-secondary)]">
        Loading...
      </div>
    );
  if (error || !data)
    return (
      <div className="flex items-center justify-center h-screen text-red-400">
        {error || "Not found"}
      </div>
    );

  const { task, annotations } = data;
  const agreement =
    annotations.length >= 2
      ? compareAnnotations(annotations[0], annotations[1])
      : null;

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Progress bar + nav header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => prevTaskId && navigateTo(prevTaskId)}
            disabled={!prevTaskId}
            className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition disabled:opacity-30"
            title="Previous (Left arrow)"
          >
            &larr; Prev
          </button>
          <span className="text-sm font-mono text-[var(--text-primary)]">
            {task.id}
          </span>
          <button
            onClick={() => nextTaskId && navigateTo(nextTaskId)}
            disabled={!nextTaskId}
            className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition disabled:opacity-30"
            title="Next (Right arrow)"
          >
            Next &rarr;
          </button>
        </div>
        <div className="flex items-center gap-4">
          {nextUnapprovedId && nextUnapprovedId !== taskId && (
            <button
              onClick={() => navigateTo(nextUnapprovedId)}
              className="px-3 py-1.5 text-sm bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition"
              title="Next unapproved (N key)"
            >
              Next unapproved &rarr;
            </button>
          )}
          <span className="text-xs text-[var(--text-secondary)]">
            {approvedCount}/{allTasks.length} approved
          </span>
          {currentIdx >= 0 && (
            <span className="text-xs text-[var(--text-secondary)]">
              Task {currentIdx + 1} of {allTasks.length}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {allTasks.length > 0 && (
        <div className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-full mb-6">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${(approvedCount / allTasks.length) * 100}%` }}
          />
        </div>
      )}

      {/* Task header */}
      <div className="border border-[var(--border)] rounded-xl p-5 mb-6">
        <div className="flex gap-6 text-sm text-[var(--text-secondary)] mb-2">
          <span>
            <strong>Language:</strong> {task.language}
          </span>
          <span>
            <strong>Domain:</strong> {task.domain}
          </span>
          <span>
            <strong>Scenario:</strong> {task.scenario}
          </span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mb-1">
          Customer said:
        </p>
        <p className="text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] rounded-lg p-3">
          {task.user_transcript}
        </p>
      </div>

      {/* Agreement summary */}
      {agreement && (
        <div
          className={`border rounded-xl p-4 mb-6 ${
            agreement.matchCount === agreement.total
              ? "border-green-500/30 bg-green-500/5"
              : agreement.matchCount >= agreement.total - 2
              ? "border-yellow-500/30 bg-yellow-500/5"
              : "border-red-500/30 bg-red-500/5"
          }`}
        >
          <h3
            className={`font-semibold mb-2 ${
              agreement.matchCount === agreement.total
                ? "text-green-400"
                : agreement.matchCount >= agreement.total - 2
                ? "text-yellow-400"
                : "text-red-400"
            }`}
          >
            {agreement.matchCount === agreement.total
              ? "Full Agreement"
              : "Partial Agreement"}{" "}
            <span className="font-normal text-sm text-[var(--text-secondary)]">
              {agreement.matchCount}/{agreement.total} fields match
            </span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {agreement.matches.map((m) => (
              <span
                key={m}
                className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400"
              >
                {m} ✓
              </span>
            ))}
            {agreement.diffs.map((d) => (
              <span
                key={d}
                className="text-xs px-2 py-1 rounded-full bg-red-500/10 text-red-400"
              >
                {d} ✗
              </span>
            ))}
          </div>
          {annotations.length >= 2 && (
            <p className="text-xs text-[var(--text-secondary)] mt-2">
              Pron errors: A={annotations[0].pron_errors.length}, B=
              {annotations[1].pron_errors.length}
            </p>
          )}
        </div>
      )}

      {/* Annotations side-by-side */}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {annotations.map((ann, idx) => (
          <div key={ann.annotator_id || idx} className="min-w-[340px] flex-1">
            <AnnotationCard
              annotation={ann}
              label={`Annotator ${String.fromCharCode(65 + idx)}`}
              agentTranscript={task.agent_transcript}
              isApproved={
                task.approved_annotation_id === ann.annotator_id
              }
              onApprove={() => handleApprove(ann.annotator_id || "")}
              approving={approving}
            />
          </div>
        ))}
        {annotations.length === 1 && (
          <div className="min-w-[340px] flex-1 border border-dashed border-[var(--border)] rounded-xl p-5 flex items-center justify-center text-[var(--text-secondary)] text-sm">
            Only one annotation submitted
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <div className="flex items-center gap-3 mt-8 pt-4 border-t border-[var(--border)]">
        <button
          onClick={() => router.push("/review")}
          className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
        >
          Back to Review Dashboard
        </button>
        <a
          href={`/annotate/${taskId}`}
          className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
        >
          Open in Annotator
        </a>
        <div className="ml-auto text-xs text-[var(--text-secondary)]">
          Keyboard: &larr;/&rarr; prev/next &middot; N next unapproved
        </div>
      </div>
    </div>
  );
}
