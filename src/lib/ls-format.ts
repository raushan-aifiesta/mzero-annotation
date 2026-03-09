/**
 * Converts internal annotation format to Label Studio-compatible JSON.
 * Mirrors LS export structure: { id, data, annotations[{ id, result[], ... }] }
 */

import type { LocalTask, LocalAnnotation } from "./local-store";

function uid(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  let id = "";
  for (let i = 0; i < 10; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

interface LSResult {
  value: Record<string, unknown>;
  id: string;
  from_name: string;
  to_name: string;
  type: string;
  origin: string;
}

export function toLabStudioFormat(
  task: LocalTask,
  annotation: LocalAnnotation | null,
  taskIndex: number
) {
  const data = {
    audio: `/audio/${task.id}.wav`,
    user_transcript: task.user_transcript,
    agent_transcript: task.agent_transcript,
    task_id: task.id,
    language: task.language,
    domain: task.domain,
    scenario: task.scenario,
    status: task.status,
    flagged: task.flagged,
  };

  if (!annotation) {
    return { id: taskIndex + 1, data, annotations: [], predictions: [] };
  }

  const result: LSResult[] = [];
  // --- Pronunciation errors → labels on agent_text ---
  for (const err of annotation.pron_errors) {
    const regionId = uid();

    result.push({
      value: { start: err.start, end: err.end, text: err.text, labels: [err.label] },
      id: regionId,
      from_name: "pron_errors",
      to_name: "agent_text",
      type: "labels",
      origin: "manual",
    });

    if (err.correction) {
      result.push({
        value: { start: err.start, end: err.end, text: [err.correction], lang: err.correction_lang || "en" },
        id: regionId,
        from_name: "correction",
        to_name: "agent_text",
        type: "textarea",
        origin: "manual",
      });
    }

    if (err.error_context.length > 0) {
      result.push({
        value: { start: err.start, end: err.end, text: err.text, choices: err.error_context },
        id: regionId,
        from_name: "error_context",
        to_name: "agent_text",
        type: "choices",
        origin: "manual",
      });
    }
  }

  // --- Ratings → choices on audio ---
  if (annotation.naturalness) {
    result.push({
      value: { choices: [annotation.naturalness] },
      id: uid(),
      from_name: "naturalness",
      to_name: "audio",
      type: "choices",
      origin: "manual",
    });
  }

  if (annotation.naturalness_comment) {
    result.push({
      value: { text: [annotation.naturalness_comment], lang: annotation.naturalness_comment_lang || "en" },
      id: uid(),
      from_name: "naturalness_comment",
      to_name: "audio",
      type: "textarea",
      origin: "manual",
    });
  }

  if (annotation.emotion) {
    result.push({
      value: { choices: [annotation.emotion] },
      id: uid(),
      from_name: "emotion",
      to_name: "audio",
      type: "choices",
      origin: "manual",
    });
  }

  if (annotation.emotion_comment) {
    result.push({
      value: { text: [annotation.emotion_comment], lang: annotation.emotion_comment_lang || "en" },
      id: uid(),
      from_name: "emotion_comment",
      to_name: "audio",
      type: "textarea",
      origin: "manual",
    });
  }

  if (annotation.speaker_consistency) {
    result.push({
      value: { choices: [annotation.speaker_consistency] },
      id: uid(),
      from_name: "consistency",
      to_name: "audio",
      type: "choices",
      origin: "manual",
    });
  }

  if (annotation.consistency_comment) {
    result.push({
      value: { text: [annotation.consistency_comment], lang: annotation.consistency_comment_lang || "en" },
      id: uid(),
      from_name: "consistency_comment",
      to_name: "audio",
      type: "textarea",
      origin: "manual",
    });
  }

  if (annotation.audio_clarity) {
    result.push({
      value: { choices: [annotation.audio_clarity] },
      id: uid(),
      from_name: "clarity",
      to_name: "audio",
      type: "choices",
      origin: "manual",
    });
  }

  if (annotation.clarity_comment) {
    result.push({
      value: { text: [annotation.clarity_comment], lang: annotation.clarity_comment_lang || "en" },
      id: uid(),
      from_name: "clarity_comment",
      to_name: "audio",
      type: "textarea",
      origin: "manual",
    });
  }

  if (annotation.number_pronunciation) {
    result.push({
      value: { choices: [annotation.number_pronunciation] },
      id: uid(),
      from_name: "number_pronunciation",
      to_name: "audio",
      type: "choices",
      origin: "manual",
    });
  }

  if (annotation.number_comment) {
    result.push({
      value: { text: [annotation.number_comment], lang: annotation.number_comment_lang || "en" },
      id: uid(),
      from_name: "number_comment",
      to_name: "audio",
      type: "textarea",
      origin: "manual",
    });
  }

  if (annotation.issues.length > 0) {
    result.push({
      value: { choices: annotation.issues },
      id: uid(),
      from_name: "issues",
      to_name: "audio",
      type: "choices",
      origin: "manual",
    });
  }

  if (annotation.notes) {
    result.push({
      value: { text: [annotation.notes], lang: annotation.notes_lang || "en" },
      id: uid(),
      from_name: "evaluator_notes",
      to_name: "audio",
      type: "textarea",
      origin: "manual",
    });
  }

  return {
    id: taskIndex + 1,
    data,
    annotations: [
      {
        id: taskIndex + 1,
        result,
        created_at: annotation.created_at,
        updated_at: annotation.created_at,
        lead_time: null,
        was_cancelled: false,
        ground_truth: false,
      },
    ],
    predictions: [],
  };
}
