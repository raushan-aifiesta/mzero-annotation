"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import WaveSurfer from "wavesurfer.js";
import TranslitInput from "@/components/TranslitInput";

type TaskStatus = 'pending' | 'in_progress' | 'submitted' | 'reviewed' | 'flagged';

interface Task {
  id: string;
  language: string;
  domain: string;
  scenario: string;
  user_transcript: string;
  agent_transcript: string;
  audio_url: string;
  is_labeled: boolean;
  status: TaskStatus;
  flagged: boolean;
}

interface PronError {
  text: string;
  start: number;   // character offset
  end: number;     // character offset
  label: string;
  correction: string;
  correction_lang: string;
  error_context: string[];
}

const PRON_LABELS = [
  { name: "Mispronounced", color: "#DC2626", hotkey: "1" },
  { name: "Skipped", color: "#6B7280", hotkey: "2" },
  { name: "Added", color: "#16A34A", hotkey: "3" },
  { name: "Unintelligible", color: "#4F46E5", hotkey: "4" },
];

const ERROR_CONTEXT_GROUPS = [
  {
    group: "Numeric",
    options: [
      { label: "Phone number", hotkey: "5" },
      { label: "Amount / Price", hotkey: "6" },
      { label: "Percentage", hotkey: "0" },
      { label: "Decimal", hotkey: "q" },
    ],
  },
  {
    group: "Identity / Code",
    options: [
      { label: "ID number (Aadhaar, PAN, etc.)", hotkey: "7" },
      { label: "PIN code", hotkey: "e" },
    ],
  },
  {
    group: "Date / Time / Units",
    options: [
      { label: "Date", hotkey: "8" },
      { label: "Time", hotkey: "9" },
      { label: "Ordinal (1st, 2nd, etc.)", hotkey: "w" },
      { label: "Measurement (kg, km, etc.)", hotkey: "t" },
    ],
  },
  {
    group: "Other",
    options: [
      { label: "Other", hotkey: "a" },
    ],
  },
];

const ISSUE_OPTIONS = [
  { label: "No issues", hotkey: "," },
  { label: "Voice changes at code-switch", hotkey: "n" },
  { label: "Unnatural pause", hotkey: "m" },
  { label: "Wrong emphasis" },
  { label: "Robotic phrase" },
  { label: "Too fast" },
  { label: "Too slow" },
  { label: "Wrong gender" },
  { label: "Breathing/artifacts" },
  { label: "Volume inconsistency" },
  { label: "Truncated audio" },
  { label: "Hallucinated content" },
];

export default function AnnotatePage() {
  const { taskId } = useParams<{ taskId: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [allTaskIds, setAllTaskIds] = useState<string[]>([]);

  // Pronunciation
  const [selectedPronLabel, setSelectedPronLabel] = useState("Mispronounced");
  const [pronErrors, setPronErrors] = useState<PronError[]>([]);
  const [selectedErrorIdx, setSelectedErrorIdx] = useState<number | null>(null);

  // JSON drawer
  const [showJsonDrawer, setShowJsonDrawer] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);

  // Ratings (single-select each)
  const [naturalness, setNaturalness] = useState("");
  const [naturalnessComment, setNaturalnessComment] = useState("");
  const [naturalnessCommentLang, setNaturalnessCommentLang] = useState("en");
  const [emotion, setEmotion] = useState("");
  const [emotionComment, setEmotionComment] = useState("");
  const [emotionCommentLang, setEmotionCommentLang] = useState("en");
  const [speakerConsistency, setSpeakerConsistency] = useState("");
  const [consistencyComment, setConsistencyComment] = useState("");
  const [consistencyCommentLang, setConsistencyCommentLang] = useState("en");
  const [audioClarity, setAudioClarity] = useState("");
  const [clarityComment, setClarityComment] = useState("");
  const [clarityCommentLang, setClarityCommentLang] = useState("en");
  const [numberPronunciation, setNumberPronunciation] = useState("");
  const [numberComment, setNumberComment] = useState("");
  const [numberCommentLang, setNumberCommentLang] = useState("en");

  // Issues + notes
  const [issues, setIssues] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [notesLang, setNotesLang] = useState("en");

  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false);
  const initialLoadRef = useRef(true);

  // Track whether mouseUp just handled a selection (so onClick doesn't undo it)
  const justSelectedRef = useRef(false);

  // Waveform
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState("00:00:00.000");
  const [duration, setDuration] = useState("00:00:00.000");
  const [playbackRate, setPlaybackRate] = useState(1);

  const router = useRouter();

  // Load task data
  useEffect(() => {
    setLoaded(false);
    Promise.all([
      fetch(`/api/tasks/${taskId}`).then((r) => r.json()),
      fetch("/api/tasks").then((r) => r.json()),
    ]).then(([taskData, allTasks]) => {
      setTask(taskData.task);
      setAllTaskIds(allTasks.map((t: Task) => t.id));

      if (taskData.annotation) {
        const a = taskData.annotation;
        setPronErrors(a.pron_errors || []);
        setNaturalness(a.naturalness || "");
        setNaturalnessComment(a.naturalness_comment || "");
        setNaturalnessCommentLang(a.naturalness_comment_lang || "en");
        setEmotion(a.emotion || "");
        setEmotionComment(a.emotion_comment || "");
        setEmotionCommentLang(a.emotion_comment_lang || "en");
        setSpeakerConsistency(a.speaker_consistency || "");
        setConsistencyComment(a.consistency_comment || "");
        setConsistencyCommentLang(a.consistency_comment_lang || "en");
        setAudioClarity(a.audio_clarity || "");
        setClarityComment(a.clarity_comment || "");
        setClarityCommentLang(a.clarity_comment_lang || "en");
        setNumberPronunciation(a.number_pronunciation || "");
        setNumberComment(a.number_comment || "");
        setNumberCommentLang(a.number_comment_lang || "en");
        setIssues(a.issues || []);
        setNotes(a.notes || "");
        setNotesLang(a.notes_lang || "en");
      } else {
        setPronErrors([]);
        setNaturalness("");
        setNaturalnessComment("");
        setNaturalnessCommentLang("en");
        setEmotion("");
        setEmotionComment(""); setEmotionCommentLang("en");
        setSpeakerConsistency("");
        setConsistencyComment(""); setConsistencyCommentLang("en");
        setAudioClarity("");
        setClarityComment(""); setClarityCommentLang("en");
        setNumberPronunciation("");
        setNumberComment(""); setNumberCommentLang("en");
        setIssues([]);
        setNotes("");
        setNotesLang("en");
      }
      setSelectedErrorIdx(null);
      setSelectedPronLabel("Mispronounced");
      isDirtyRef.current = false;
      initialLoadRef.current = true;
      setAutoSaveStatus('idle');
      setLoaded(true);
    });
  }, [taskId]);

  // Initialize waveform
  useEffect(() => {
    if (!task || !waveformRef.current || !loaded) return;

    // Destroy previous instance
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: "#d4d4d8",
      progressColor: "#2563eb",
      cursorColor: "#2563eb",
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 120,
      normalize: true,
    });

    ws.load(task.audio_url);

    ws.on("ready", () => {
      const dur = ws.getDuration();
      setDuration(formatTime(dur));
      ws.setPlaybackRate(playbackRate);
    });

    ws.on("timeupdate", (time: number) => {
      setCurrentTime(formatTime(time));
    });

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));

    wavesurferRef.current = ws;

    return () => {
      ws.destroy();
    };
  }, [task, loaded]);

  function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
  }

  const currentIdx = allTaskIds.indexOf(taskId);
  const prevId = currentIdx > 0 ? allTaskIds[currentIdx - 1] : null;
  const nextId = currentIdx < allTaskIds.length - 1 ? allTaskIds[currentIdx + 1] : null;

  const transcriptRef = useRef<HTMLDivElement>(null);

  // Get character offset of a node/offset within the transcript container
  function getCharOffset(container: HTMLElement, node: Node, offset: number): number {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let charCount = 0;
    while (walker.nextNode()) {
      if (walker.currentNode === node) {
        return charCount + offset;
      }
      charCount += (walker.currentNode.textContent || "").length;
    }
    return charCount;
  }

  function handleTranscriptMouseUp() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !transcriptRef.current) return;

    const range = sel.getRangeAt(0);
    const container = transcriptRef.current;

    const startChar = getCharOffset(container, range.startContainer, range.startOffset);
    const endChar = getCharOffset(container, range.endContainer, range.endOffset);

    if (startChar === endChar) {
      sel.removeAllRanges();
      return;
    }

    const transcript = task!.agent_transcript;
    const s = Math.max(0, Math.min(startChar, endChar));
    const e = Math.min(transcript.length, Math.max(startChar, endChar));
    const selectedText = transcript.slice(s, e);

    if (!selectedText.trim()) {
      sel.removeAllRanges();
      return;
    }

    // Remove overlapping errors
    const cleaned = pronErrors.filter(
      (err) => !(err.start < e && err.end > s)
    );
    const newError: PronError = {
      text: selectedText,
      start: s,
      end: e,
      label: selectedPronLabel,
      correction: "",
      correction_lang: "en",
      error_context: [],
    };
    const updated = [...cleaned, newError].sort((a, b) => a.start - b.start);
    setPronErrors(updated);
    setSelectedErrorIdx(updated.findIndex((err) => err.start === s && err.end === e));
    justSelectedRef.current = true;

    sel.removeAllRanges();
  }

  function handleTranscriptClick(e: React.MouseEvent) {
    // Skip if mouseUp just created a region (prevents immediate toggle-off)
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    // If user just clicks (no drag), check if they clicked on a labeled region
    if (window.getSelection()?.toString()) return;

    const container = transcriptRef.current;
    if (!container) return;

    // Get click position as character offset
    const range = document.caretRangeFromPoint(e.clientX, e.clientY);
    if (!range) return;
    const clickOffset = getCharOffset(container, range.startContainer, range.startOffset);

    const errorIdx = pronErrors.findIndex(
      (err) => clickOffset >= err.start && clickOffset < err.end
    );

    if (errorIdx >= 0) {
      if (selectedErrorIdx === errorIdx) {
        setSelectedErrorIdx(null);
      } else {
        setSelectedErrorIdx(errorIdx);
      }
    }
  }

  function updatePronError(errorIdx: number, field: string, value: string | string[]) {
    setPronErrors(
      pronErrors.map((e, i) =>
        i === errorIdx ? { ...e, [field]: value } : e
      )
    );
  }

  function removeError(errorIdx: number) {
    setPronErrors(pronErrors.filter((_, i) => i !== errorIdx));
    if (selectedErrorIdx === errorIdx) setSelectedErrorIdx(null);
  }

  function setErrorContext(errorIdx: number, ctx: string) {
    const error = pronErrors[errorIdx];
    if (!error) return;
    // Single-select: toggle off if same, otherwise set
    const newCtx = error.error_context[0] === ctx ? [] : [ctx];
    updatePronError(errorIdx, "error_context", newCtx);
  }

  function toggleIssue(issue: string) {
    setIssues((prev) => {
      if (issue === "No issues") {
        return prev.includes("No issues") ? [] : ["No issues"];
      }
      const without = prev.filter((i) => i !== "No issues");
      return without.includes(issue) ? without.filter((i) => i !== issue) : [...without, issue];
    });
  }

  // Build the annotation payload (reused by both auto-save and submit)
  const buildPayload = useCallback(() => ({
    task_id: taskId,
    pron_errors: pronErrors,
    naturalness,
    naturalness_comment: naturalnessComment,
    naturalness_comment_lang: naturalnessCommentLang,
    emotion,
    emotion_comment: emotionComment,
    emotion_comment_lang: emotionCommentLang,
    speaker_consistency: speakerConsistency,
    consistency_comment: consistencyComment,
    consistency_comment_lang: consistencyCommentLang,
    audio_clarity: audioClarity,
    clarity_comment: clarityComment,
    clarity_comment_lang: clarityCommentLang,
    number_pronunciation: numberPronunciation,
    number_comment: numberComment,
    number_comment_lang: numberCommentLang,
    issues,
    notes,
    notes_lang: notesLang,
  }), [taskId, pronErrors, naturalness, naturalnessComment, naturalnessCommentLang, emotion, emotionComment, emotionCommentLang, speakerConsistency, consistencyComment, consistencyCommentLang, audioClarity, clarityComment, clarityCommentLang, numberPronunciation, numberComment, numberCommentLang, issues, notes, notesLang]);

  const handleSave = useCallback(async (andNext: boolean = true) => {
    setSaving(true);
    // Cancel any pending auto-save
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    try {
      const res = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...buildPayload(), status: "submitted" }),
      });
      if (!res.ok) throw new Error("Save failed");
      isDirtyRef.current = false;

      if (andNext && nextId) {
        router.push(`/annotate/${nextId}`);
      } else {
        router.push("/");
      }
    } catch (err) {
      alert("Save failed: " + (err instanceof Error ? err.message : "Unknown"));
    } finally {
      setSaving(false);
    }
  }, [buildPayload, nextId, router]);

  // Auto-save: debounced 2s after any field change
  const performAutoSave = useCallback(async () => {
    if (!isDirtyRef.current || !loaded) return;
    setAutoSaveStatus('saving');
    try {
      const res = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...buildPayload(), status: "in_progress" }),
      });
      if (res.ok) {
        isDirtyRef.current = false;
        setAutoSaveStatus('saved');
        // Update task status locally
        setTask(prev => prev ? { ...prev, status: 'in_progress', is_labeled: true } : prev);
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
      }
    } catch {
      // Silently fail auto-save — user can still submit manually
      setAutoSaveStatus('idle');
    }
  }, [buildPayload, loaded]);

  // Watch all annotation fields for changes → trigger debounced auto-save
  useEffect(() => {
    if (!loaded || initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }
    isDirtyRef.current = true;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      performAutoSave();
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [pronErrors, naturalness, naturalnessComment, naturalnessCommentLang, emotion, emotionComment, emotionCommentLang, speakerConsistency, consistencyComment, consistencyCommentLang, audioClarity, clarityComment, clarityCommentLang, numberPronunciation, numberComment, numberCommentLang, issues, notes, notesLang, loaded, performAutoSave]);

  // Mark as reviewed
  const handleMarkReviewed = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "reviewed" }),
      });
      if (!res.ok) throw new Error("Failed to mark as reviewed");
      setTask(prev => prev ? { ...prev, status: 'reviewed' } : prev);
    } catch (err) {
      alert("Failed: " + (err instanceof Error ? err.message : "Unknown"));
    }
  }, [taskId]);

  const handleToggleFlag = useCallback(async () => {
    const newFlagged = !task?.flagged;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flagged: newFlagged }),
      });
      if (!res.ok) throw new Error("Failed to toggle flag");
      setTask(prev => prev ? { ...prev, flagged: newFlagged } : prev);
    } catch (err) {
      alert("Failed: " + (err instanceof Error ? err.message : "Unknown"));
    }
  }, [taskId, task?.flagged]);

  // Keyboard: Space=play/pause, Cmd+S=submit
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave(true);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleSave]);

  if (!task || !loaded) {
    return <div className="p-8 text-[var(--text-secondary)]">Loading...</div>;
  }

  const selectedError = selectedErrorIdx !== null ? pronErrors[selectedErrorIdx] : null;

  function uid(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
    let id = "";
    for (let i = 0; i < 10; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
  }

  function buildLSAnnotation() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any[] = [];

    for (const err of pronErrors) {
      const regionId = uid();
      result.push({
        value: { start: err.start, end: err.end, text: err.text, labels: [err.label] },
        id: regionId, from_name: "pron_errors", to_name: "agent_text", type: "labels", origin: "manual",
      });
      if (err.correction) {
        result.push({
          value: { start: err.start, end: err.end, text: [err.correction], lang: err.correction_lang || "en" },
          id: regionId, from_name: "correction", to_name: "agent_text", type: "textarea", origin: "manual",
        });
      }
      if (err.error_context.length > 0) {
        result.push({
          value: { start: err.start, end: err.end, text: err.text, choices: err.error_context },
          id: regionId, from_name: "error_context", to_name: "agent_text", type: "choices", origin: "manual",
        });
      }
    }

    if (naturalness) result.push({ value: { choices: [naturalness] }, id: uid(), from_name: "naturalness", to_name: "audio", type: "choices", origin: "manual" });
    if (naturalnessComment) result.push({ value: { text: [naturalnessComment], lang: naturalnessCommentLang }, id: uid(), from_name: "naturalness_comment", to_name: "audio", type: "textarea", origin: "manual" });
    if (emotion) result.push({ value: { choices: [emotion] }, id: uid(), from_name: "emotion", to_name: "audio", type: "choices", origin: "manual" });
    if (emotionComment) result.push({ value: { text: [emotionComment], lang: emotionCommentLang }, id: uid(), from_name: "emotion_comment", to_name: "audio", type: "textarea", origin: "manual" });
    if (speakerConsistency) result.push({ value: { choices: [speakerConsistency] }, id: uid(), from_name: "consistency", to_name: "audio", type: "choices", origin: "manual" });
    if (consistencyComment) result.push({ value: { text: [consistencyComment], lang: consistencyCommentLang }, id: uid(), from_name: "consistency_comment", to_name: "audio", type: "textarea", origin: "manual" });
    if (audioClarity) result.push({ value: { choices: [audioClarity] }, id: uid(), from_name: "clarity", to_name: "audio", type: "choices", origin: "manual" });
    if (clarityComment) result.push({ value: { text: [clarityComment], lang: clarityCommentLang }, id: uid(), from_name: "clarity_comment", to_name: "audio", type: "textarea", origin: "manual" });
    if (numberPronunciation) result.push({ value: { choices: [numberPronunciation] }, id: uid(), from_name: "number_pronunciation", to_name: "audio", type: "choices", origin: "manual" });
    if (numberComment) result.push({ value: { text: [numberComment], lang: numberCommentLang }, id: uid(), from_name: "number_comment", to_name: "audio", type: "textarea", origin: "manual" });
    if (issues.length > 0) result.push({ value: { choices: issues }, id: uid(), from_name: "issues", to_name: "audio", type: "choices", origin: "manual" });
    if (notes) result.push({ value: { text: [notes], lang: notesLang }, id: uid(), from_name: "evaluator_notes", to_name: "audio", type: "textarea", origin: "manual" });

    return {
      id: currentIdx + 1,
      data: {
        audio: task!.audio_url,
        user_transcript: task!.user_transcript,
        agent_transcript: task!.agent_transcript,
        task_id: task!.id,
        language: task!.language,
        domain: task!.domain,
        scenario: task!.scenario,
      },
      annotations: result.length > 0 ? [{
        id: currentIdx + 1,
        result,
        was_cancelled: false,
        ground_truth: false,
      }] : [],
      predictions: [],
    };
  }

  function copyJson() {
    navigator.clipboard.writeText(JSON.stringify(buildLSAnnotation(), null, 2));
    setJsonCopied(true);
    setTimeout(() => setJsonCopied(false), 2000);
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-secondary)] flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">
            &larr; Dashboard
          </Link>
          <span className="text-sm font-medium">{task.id}</span>
          <span className="text-xs text-[var(--text-secondary)]">
            {currentIdx + 1} / {allTaskIds.length}
          </span>
          {/* Status badge */}
          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
            task.status === 'reviewed' ? 'bg-green-100 text-green-700' :
            task.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
            task.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
            'bg-gray-100 text-gray-500'
          }`}>
            {task.status === 'reviewed' ? 'Reviewed' :
             task.status === 'submitted' ? 'Submitted' :
             task.status === 'in_progress' ? 'In Progress' : 'Pending'}
          </span>
          {/* Flag button */}
          <button
            onClick={handleToggleFlag}
            title={task.flagged ? "Unflag this task" : "Flag for doubt/review"}
            className={`px-2 py-0.5 rounded text-sm transition ${
              task.flagged
                ? "bg-orange-100 text-orange-600 hover:bg-orange-200"
                : "text-[var(--text-secondary)] hover:text-orange-500"
            }`}
          >
            {task.flagged ? "\u2691 Flagged" : "\u2690 Flag"}
          </button>
          {/* Auto-save indicator */}
          {autoSaveStatus === 'saving' && (
            <span className="text-[10px] text-amber-500">Saving...</span>
          )}
          {autoSaveStatus === 'saved' && (
            <span className="text-[10px] text-green-500">Saved</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowJsonDrawer(!showJsonDrawer)}
            className={`px-3 py-1 border rounded text-sm transition ${
              showJsonDrawer
                ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/5"
                : "border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]"
            }`}
          >
            {showJsonDrawer ? "Hide JSON" : "{ } JSON"}
          </button>
          {prevId && (
            <Link href={`/annotate/${prevId}`} className="px-3 py-1 border border-[var(--border)] rounded text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition">
              &larr; Prev
            </Link>
          )}
          {nextId && (
            <Link href={`/annotate/${nextId}`} className="px-3 py-1 border border-[var(--border)] rounded text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition">
              Next &rarr;
            </Link>
          )}
        </div>
      </div>

      {/* JSON Slide-in Drawer */}
      {showJsonDrawer && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setShowJsonDrawer(false)}
          />
          {/* Drawer */}
          <div className="fixed top-0 right-0 h-full w-[480px] max-w-[90vw] bg-[var(--bg-secondary)] border-l border-[var(--border)] shadow-2xl z-50 flex flex-col animate-slide-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <h3 className="text-sm font-bold">Annotation JSON</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyJson}
                  className="px-3 py-1 text-xs border border-[var(--border)] rounded hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
                >
                  {jsonCopied ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={() => setShowJsonDrawer(false)}
                  className="w-7 h-7 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded hover:bg-[var(--bg-tertiary)] transition"
                >
                  &times;
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <pre className="text-xs font-mono text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                {JSON.stringify(buildLSAnnotation(), null, 2)}
              </pre>
            </div>
          </div>
        </>
      )}

      {/* Main scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-5">

          {/* Instruction banner */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] border-l-4 border-l-[var(--accent)] rounded-lg p-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Listen to the AI agent&apos;s response and evaluate quality. Read the customer&apos;s message first for context.
            </p>
          </div>

          {/* Language & Domain */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4 flex gap-8">
            <div>
              <span className="text-xs text-[var(--text-secondary)]">Language:</span>
              <span className="ml-2 text-sm font-medium">{task.language}</span>
            </div>
            <div>
              <span className="text-xs text-[var(--text-secondary)]">Domain:</span>
              <span className="ml-2 text-sm font-medium">{task.domain}</span>
            </div>
            <div>
              <span className="text-xs text-[var(--text-secondary)]">Scenario:</span>
              <span className="ml-2 text-sm font-medium">{task.scenario}</span>
            </div>
          </div>

          {/* Customer Said */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] border-l-4 border-l-[#8b5cf6] rounded-lg p-4">
            <h3 className="text-sm font-bold mb-1">Customer Said</h3>
            <p className="text-sm leading-relaxed">{task.user_transcript}</p>
          </div>

          {/* Agent Voice — Waveform */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] border-l-4 border-l-[#10b981] rounded-lg p-4">
            <h3 className="text-lg font-bold mb-3">Agent Voice</h3>
            <div ref={waveformRef} className="mb-3 rounded-lg overflow-hidden" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => wavesurferRef.current?.skip(-5)}
                  className="w-8 h-8 flex items-center justify-center rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition text-sm"
                >
                  &lsaquo;
                </button>
                <button
                  onClick={() => {
                    wavesurferRef.current?.playPause();
                  }}
                  className="w-10 h-10 flex items-center justify-center rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition"
                >
                  {isPlaying ? "II" : "\u25B6"}
                </button>
                <button
                  onClick={() => wavesurferRef.current?.skip(5)}
                  className="w-8 h-8 flex items-center justify-center rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition text-sm"
                >
                  &rsaquo;
                </button>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono text-[var(--text-secondary)]">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const newRate = Math.max(0.25, +(playbackRate - 0.25).toFixed(2));
                      setPlaybackRate(newRate);
                      if (wavesurferRef.current) wavesurferRef.current.setPlaybackRate(newRate);
                    }}
                    className="w-6 h-6 flex items-center justify-center rounded bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition"
                  >
                    −
                  </button>
                  <span className="px-2 py-1 bg-[var(--bg-tertiary)] rounded min-w-[3.5rem] text-center">{playbackRate}x</span>
                  <button
                    onClick={() => {
                      const newRate = Math.min(3, +(playbackRate + 0.25).toFixed(2));
                      setPlaybackRate(newRate);
                      if (wavesurferRef.current) wavesurferRef.current.setPlaybackRate(newRate);
                    }}
                    className="w-6 h-6 flex items-center justify-center rounded bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition"
                  >
                    +
                  </button>
                </div>
                <span className="px-2 py-1 bg-[var(--bg-tertiary)] rounded">{currentTime}</span>
                <span className="px-2 py-1 bg-[var(--bg-tertiary)] rounded">{duration}</span>
                <a
                  href={task.audio_url}
                  download={`${task.id}.wav`}
                  title="Download audio"
                  className="w-7 h-7 flex items-center justify-center rounded bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent)]/10 transition"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Pronunciation Accuracy */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] border-l-4 border-l-[#10b981] rounded-lg p-4">
            <h3 className="text-lg font-bold mb-1">Pronunciation Accuracy</h3>
            <p className="text-xs text-[var(--text-secondary)] mb-3">
              Select a label, then click on the word in the transcript below:
            </p>

            {/* Label buttons */}
            <div className="flex gap-2 mb-4">
              {PRON_LABELS.map((l) => (
                <button
                  key={l.name}
                  onClick={() => setSelectedPronLabel(l.name)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border-l-4 transition ${
                    selectedPronLabel === l.name
                      ? "bg-[var(--accent)]/15 text-[var(--text-primary)]"
                      : "bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                  style={{ borderLeftColor: l.color }}
                >
                  {l.name}
                  <span className="ml-1.5 text-xs text-[var(--text-secondary)]">{l.hotkey}</span>
                </button>
              ))}
            </div>

            {/* Agent Transcript — select any text (characters, partial words, multiple words) */}
            <h4 className="text-base font-bold mb-2">Agent Transcript</h4>
            <p className="text-xs text-[var(--text-secondary)] mb-2">
              Select any text to label it. Click a labeled region to edit it.
            </p>
            <div
              ref={transcriptRef}
              onMouseUp={handleTranscriptMouseUp}
              onClick={handleTranscriptClick}
              className="text-base leading-loose mb-3 select-text cursor-text p-3 bg-[var(--bg-tertiary)] rounded-lg"
            >
              {(() => {
                const text = task.agent_transcript;
                // Build segments: split text into labeled and unlabeled parts
                const sorted = [...pronErrors].sort((a, b) => a.start - b.start);
                const segments: { text: string; errorIdx: number; start: number }[] = [];
                let pos = 0;
                for (const err of sorted) {
                  if (err.start > pos) {
                    segments.push({ text: text.slice(pos, err.start), errorIdx: -1, start: pos });
                  }
                  segments.push({ text: text.slice(err.start, err.end), errorIdx: pronErrors.indexOf(err), start: err.start });
                  pos = err.end;
                }
                if (pos < text.length) {
                  segments.push({ text: text.slice(pos), errorIdx: -1, start: pos });
                }

                return segments.map((seg, i) => {
                  if (seg.errorIdx < 0) {
                    return <span key={i}>{seg.text}</span>;
                  }
                  const err = pronErrors[seg.errorIdx];
                  const labelDef = PRON_LABELS.find((l) => l.name === err.label);
                  const isSelected = selectedErrorIdx === seg.errorIdx;
                  return (
                    <span
                      key={i}
                      className={`rounded px-0.5 font-semibold cursor-pointer transition-all ${
                        isSelected ? "ring-2 ring-offset-1 ring-[var(--accent)]" : ""
                      }`}
                      style={labelDef ? {
                        backgroundColor: labelDef.color + "20",
                        color: labelDef.color,
                        borderBottom: `2px solid ${labelDef.color}`,
                      } : undefined}
                    >
                      {seg.text}
                    </span>
                  );
                });
              })()}
            </div>

            {/* Labeled regions list — each region expands inline */}
            {pronErrors.length > 0 && (
              <div className="mb-3 space-y-2">
                <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">Labeled regions:</p>
                {pronErrors.map((err, idx) => {
                  const labelDef = PRON_LABELS.find((l) => l.name === err.label);
                  const isOpen = selectedErrorIdx === idx;
                  return (
                    <div key={idx} className={`rounded-lg border transition ${
                      isOpen ? "border-[var(--border)] bg-white" : "border-[var(--border)] bg-white"
                    }`}>
                      {/* Region header row */}
                      <div
                        onClick={() => setSelectedErrorIdx(isOpen ? null : idx)}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer"
                      >
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: labelDef?.color }}
                        />
                        <span className="font-medium truncate" style={{ color: labelDef?.color }}>
                          &ldquo;{err.text}&rdquo;
                        </span>
                        {/* Label type pills */}
                        <div className="flex gap-1 ml-1" onClick={(e) => e.stopPropagation()}>
                          {PRON_LABELS.map((l) => (
                            <button
                              key={l.name}
                              onClick={() => updatePronError(idx, "label", l.name)}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition border ${
                                err.label === l.name
                                  ? "border-current"
                                  : "border-transparent opacity-60 hover:opacity-100"
                              }`}
                              style={{ color: l.color, backgroundColor: l.color + "20" }}
                              title={l.name}
                            >
                              {l.name.slice(0, 3)}
                            </button>
                          ))}
                        </div>
                        <div className="ml-auto flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedErrorIdx(isOpen ? null : idx)}
                            className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition"
                            title={isOpen ? "Collapse" : "Expand"}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              {isOpen ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
                            </svg>
                          </button>
                          <button
                            onClick={() => removeError(idx)}
                            className="w-6 h-6 flex items-center justify-center rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition"
                            title="Delete"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Expanded editing panel */}
                      {isOpen && (
                        <div className="px-3 pb-3 space-y-3">
                          {/* Correction input */}
                          <div>
                            <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">
                              Correction for &ldquo;{err.text}&rdquo;
                            </p>
                            <TranslitInput
                              value={err.correction}
                              onChange={(v) => updatePronError(idx, "correction", v)}
                              onLangChange={(lang) => updatePronError(idx, "correction_lang", lang)}
                              language={task!.language}
                              placeholder="Type the correct/added word... (type in English for Hindi transliteration)"
                            />
                          </div>

                          {/* Error context — Mispronounced only */}
                          {err.label === "Mispronounced" && (
                            <div>
                              <p className="text-sm font-medium text-[var(--text-primary)] mb-2">
                                What type of content was mispronounced?
                              </p>
                              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                                {ERROR_CONTEXT_GROUPS.map((grp) => (
                                  <div key={grp.group}>
                                    <p className="text-[11px] uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">{grp.group}</p>
                                    <div className="space-y-0.5">
                                      {grp.options.map((opt) => {
                                        const isSelected = err.error_context[0] === opt.label;
                                        return (
                                          <button
                                            key={opt.label}
                                            onClick={() => setErrorContext(idx, opt.label)}
                                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition text-left border ${
                                              isSelected
                                                ? "border-[var(--text-primary)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-medium"
                                                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                                            }`}
                                          >
                                            <span className="flex-1">{opt.label}</span>
                                            <kbd className="text-[10px] px-1.5 py-0.5 rounded text-[var(--text-secondary)] bg-[var(--border)]">{opt.hotkey}</kbd>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Naturalness */}
          <Section title="Naturalness" description="Does it sound human? Rate prosody, rhythm, pacing" color="purple">
            <RadioGroup
              options={["Low", "Medium", "High"]}
              hotkeys={["s", "d", "f"]}
              value={naturalness}
              onChange={setNaturalness}
            />
            <div className="mt-3">
              <TranslitInput
                value={naturalnessComment}
                onChange={setNaturalnessComment}
                onLangChange={setNaturalnessCommentLang}
                language={task.language}
                placeholder="Comment on naturalness..."
                className="w-full px-3 py-2 pr-16 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </Section>

          {/* Emotional Appropriateness */}
          <Section title="Emotional Appropriateness" description="Does the tone match the conversation context?" color="blue">
            <RadioGroup
              options={["Appropriate", "Neutral", "Inappropriate"]}
              hotkeys={["g", "z", "x"]}
              value={emotion}
              onChange={setEmotion}
            />
            <div className="mt-3">
              <TranslitInput
                value={emotionComment}
                onChange={setEmotionComment}
                onLangChange={setEmotionCommentLang}
                language={task.language}
                placeholder="Comment on emotional appropriateness..."
                className="w-full px-3 py-2 pr-16 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </Section>

          {/* Speaker Consistency */}
          <Section title="Speaker Consistency" description="Same voice identity throughout? No shifts at language switches?" color="teal">
            <RadioGroup
              options={["Consistent", "Minor shift", "Inconsistent"]}
              hotkeys={["c", "v", "b"]}
              value={speakerConsistency}
              onChange={setSpeakerConsistency}
            />
            <div className="mt-3">
              <TranslitInput
                value={consistencyComment}
                onChange={setConsistencyComment}
                onLangChange={setConsistencyCommentLang}
                language={task.language}
                placeholder="Comment on speaker consistency..."
                className="w-full px-3 py-2 pr-16 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </Section>

          {/* Audio Clarity */}
          <Section title="Audio Clarity / Quality" description="Technical quality — noise, artifacts, distortion" color="amber">
            <RadioGroup
              options={["Clean", "Minor issues", "Poor"]}
              hotkeys={["y", "i", "o"]}
              value={audioClarity}
              onChange={setAudioClarity}
            />
            <div className="mt-3">
              <TranslitInput
                value={clarityComment}
                onChange={setClarityComment}
                onLangChange={setClarityCommentLang}
                language={task.language}
                placeholder="Comment on audio clarity..."
                className="w-full px-3 py-2 pr-16 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </Section>

          {/* Number / ID Pronunciation */}
          <Section title="Number / ID Pronunciation" description="How accurately are numbers read? (prices, phone numbers, Aadhaar, order IDs, etc)" color="rose">
            <RadioGroup
              options={["Accurate", "Partially correct", "Incorrect", "No numbers present"]}
              hotkeys={["p", "j", "k", "l"]}
              value={numberPronunciation}
              onChange={setNumberPronunciation}
            />
            <div className="mt-3">
              <TranslitInput
                value={numberComment}
                onChange={setNumberComment}
                onLangChange={setNumberCommentLang}
                language={task.language}
                placeholder="Comment on number pronunciation..."
                className="w-full px-3 py-2 pr-16 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </Section>

          {/* Issues */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5">
            <h3 className="text-base font-bold mb-1">Issues (check all that apply)</h3>
            <p className="text-xs text-[var(--text-secondary)] mb-3">Flag any specific problems you noticed</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4">
              {ISSUE_OPTIONS.map((opt) => (
                <label key={opt.label} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={issues.includes(opt.label)}
                    onChange={() => toggleIssue(opt.label)}
                    className="w-4 h-4 rounded border-[var(--border)] bg-[var(--bg-tertiary)] accent-[var(--accent)]"
                  />
                  <span className="text-[var(--text-secondary)]">{opt.label}</span>
                  {opt.hotkey && (
                    <span className="text-[10px] text-[var(--text-secondary)]">[{opt.hotkey}]</span>
                  )}
                </label>
              ))}
            </div>

            <TranslitInput
              value={notes}
              onChange={setNotes}
              onLangChange={setNotesLang}
              language={task.language}
              placeholder="Timestamps, edge cases, anything unusual about this sample..."
              className="w-full px-3 py-2 pr-16 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          {/* Submit / Review */}
          <div className="flex gap-3 pb-8">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="px-6 py-2.5 border border-[var(--border)] text-[var(--text-secondary)] font-medium rounded-lg text-sm hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition disabled:opacity-50"
            >
              Submit &amp; Back
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex-1 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium rounded-lg text-sm transition disabled:opacity-50"
            >
              {saving ? "Submitting..." : nextId ? "Submit & Next (\u2318S)" : "Submit & Finish (\u2318S)"}
            </button>
            {task.status === 'submitted' && (
              <button
                onClick={handleMarkReviewed}
                className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg text-sm transition"
              >
                Mark Reviewed
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function Section({
  title,
  description,
  color,
  children,
}: {
  title: string;
  description: string;
  color: string;
  children: React.ReactNode;
}) {
  const accentColors: Record<string, string> = {
    purple: "#8b5cf6",
    blue: "#2563eb",
    teal: "#14b8a6",
    amber: "#f59e0b",
    rose: "#f43f5e",
    green: "#10b981",
  };

  return (
    <div
      className="bg-[var(--bg-secondary)] border border-[var(--border)] border-l-4 rounded-lg p-5"
      style={{ borderLeftColor: accentColors[color] || "#d4d4d8" }}
    >
      <h3 className="text-base font-bold mb-0.5">{title}</h3>
      <p className="text-xs text-[var(--text-secondary)] mb-3">{description}</p>
      {children}
    </div>
  );
}

function RadioGroup({
  options,
  hotkeys,
  value,
  onChange,
}: {
  options: string[];
  hotkeys: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((opt, i) => (
        <label key={opt} className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={options.join("-")}
            checked={value === opt}
            onChange={() => onChange(opt)}
            className="w-4 h-4 accent-[var(--accent)]"
          />
          <span className={`text-sm ${value === opt ? "text-[var(--text-primary)] font-medium" : "text-[var(--text-secondary)]"}`}>
            {opt}
          </span>
          {hotkeys[i] && (
            <span className="text-[10px] text-[var(--text-secondary)]">[{hotkeys[i]}]</span>
          )}
        </label>
      ))}
    </div>
  );
}
