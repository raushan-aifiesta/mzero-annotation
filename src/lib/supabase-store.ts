import { createClient } from "@/lib/supabase/server";
import type { LocalTask, LocalAnnotation, TaskStatus } from "./local-store";

export async function loadTasks(): Promise<LocalTask[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tata_eval_tasks")
    .select("*")
    .order("id");

  if (error) throw new Error(`Failed to load tasks: ${error.message}`);

  return (data || []).map((row) => {
    const status: TaskStatus = row.status || (row.is_labeled ? 'submitted' : 'pending');
    return {
      id: row.id,
      language: row.language,
      domain: row.domain,
      scenario: row.scenario,
      user_transcript: row.user_transcript,
      agent_transcript: row.agent_transcript,
      audio_url: row.audio_url,
      is_labeled: status !== 'pending',
      status,
      flagged: row.flagged || false,
      approved_annotation_id: row.approved_annotation_id || undefined,
    };
  });
}

export async function loadAnnotations(): Promise<LocalAnnotation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tata_eval_annotations")
    .select("*");

  if (error) throw new Error(`Failed to load annotations: ${error.message}`);

  return (data || []).map(mapAnnotationRow);
}

export async function saveAnnotation(annotation: LocalAnnotation, status: TaskStatus = 'submitted'): Promise<void> {
  const supabase = await createClient();

  // Upsert annotation (task_id is UNIQUE)
  const { error: annError } = await supabase
    .from("tata_eval_annotations")
    .upsert(
      {
        task_id: annotation.task_id,
        annotator_id: annotation.annotator_id || "anonymous",
        pron_errors: annotation.pron_errors,
        naturalness: annotation.naturalness,
        naturalness_comment: annotation.naturalness_comment,
        naturalness_comment_lang: annotation.naturalness_comment_lang,
        emotion: annotation.emotion,
        emotion_comment: annotation.emotion_comment,
        emotion_comment_lang: annotation.emotion_comment_lang,
        speaker_consistency: annotation.speaker_consistency,
        consistency_comment: annotation.consistency_comment,
        consistency_comment_lang: annotation.consistency_comment_lang,
        audio_clarity: annotation.audio_clarity,
        clarity_comment: annotation.clarity_comment,
        clarity_comment_lang: annotation.clarity_comment_lang,
        number_pronunciation: annotation.number_pronunciation,
        number_comment: annotation.number_comment,
        number_comment_lang: annotation.number_comment_lang,
        issues: annotation.issues,
        notes: annotation.notes,
        notes_lang: annotation.notes_lang,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "task_id,annotator_id" }
    );

  if (annError) throw new Error(`Failed to save annotation: ${annError.message}`);

  // Update task status + is_labeled
  const { error: taskError } = await supabase
    .from("tata_eval_tasks")
    .update({ is_labeled: status !== 'pending', status })
    .eq("id", annotation.task_id);

  if (taskError) throw new Error(`Failed to update task: ${taskError.message}`);
}

export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tata_eval_tasks")
    .update({ status, is_labeled: status !== 'pending' })
    .eq("id", taskId);

  if (error) throw new Error(`Failed to update task status: ${error.message}`);
}

export async function toggleTaskFlag(taskId: string, flagged: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tata_eval_tasks")
    .update({ flagged })
    .eq("id", taskId);

  if (error) throw new Error(`Failed to toggle flag: ${error.message}`);
}

export async function getAnnotation(taskId: string): Promise<LocalAnnotation | null> {
  const supabase = await createClient();
  // Use limit(1) instead of maybeSingle() — tasks can have multiple annotations
  const { data, error } = await supabase
    .from("tata_eval_annotations")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw new Error(`Failed to get annotation: ${error.message}`);
  if (!data || data.length === 0) return null;

  return mapAnnotationRow(data[0]);
}

export async function getAnnotationsForTask(taskId: string): Promise<LocalAnnotation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tata_eval_annotations")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to get annotations: ${error.message}`);
  return (data || []).map(mapAnnotationRow);
}

export async function approveAnnotation(taskId: string, annotatorId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tata_eval_tasks")
    .update({ approved_annotation_id: annotatorId, status: 'reviewed' as TaskStatus, is_labeled: true })
    .eq("id", taskId);

  if (error) throw new Error(`Failed to approve annotation: ${error.message}`);
}

function mapAnnotationRow(data: Record<string, unknown>): LocalAnnotation {
  return {
    task_id: data.task_id as string,
    annotator_id: (data.annotator_id as string) || undefined,
    pron_errors: (data.pron_errors as LocalAnnotation["pron_errors"]) || [],
    naturalness: (data.naturalness as string) || "",
    naturalness_comment: (data.naturalness_comment as string) || "",
    naturalness_comment_lang: (data.naturalness_comment_lang as string) || "en",
    emotion: (data.emotion as string) || "",
    emotion_comment: (data.emotion_comment as string) || "",
    emotion_comment_lang: (data.emotion_comment_lang as string) || "en",
    speaker_consistency: (data.speaker_consistency as string) || "",
    consistency_comment: (data.consistency_comment as string) || "",
    consistency_comment_lang: (data.consistency_comment_lang as string) || "en",
    audio_clarity: (data.audio_clarity as string) || "",
    clarity_comment: (data.clarity_comment as string) || "",
    clarity_comment_lang: (data.clarity_comment_lang as string) || "en",
    number_pronunciation: (data.number_pronunciation as string) || "",
    number_comment: (data.number_comment as string) || "",
    number_comment_lang: (data.number_comment_lang as string) || "en",
    issues: (data.issues as string[]) || [],
    notes: (data.notes as string) || "",
    notes_lang: (data.notes_lang as string) || "en",
    created_at: data.created_at as string,
  };
}
