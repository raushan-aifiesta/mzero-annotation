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
    };
  });
}

export async function loadAnnotations(): Promise<LocalAnnotation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tata_eval_annotations")
    .select("*");

  if (error) throw new Error(`Failed to load annotations: ${error.message}`);

  return (data || []).map((row) => ({
    task_id: row.task_id,
    pron_errors: row.pron_errors || [],
    naturalness: row.naturalness || "",
    naturalness_comment: row.naturalness_comment || "",
    naturalness_comment_lang: row.naturalness_comment_lang || "en",
    emotion: row.emotion || "",
    emotion_comment: row.emotion_comment || "",
    emotion_comment_lang: row.emotion_comment_lang || "en",
    speaker_consistency: row.speaker_consistency || "",
    consistency_comment: row.consistency_comment || "",
    consistency_comment_lang: row.consistency_comment_lang || "en",
    audio_clarity: row.audio_clarity || "",
    clarity_comment: row.clarity_comment || "",
    clarity_comment_lang: row.clarity_comment_lang || "en",
    number_pronunciation: row.number_pronunciation || "",
    number_comment: row.number_comment || "",
    number_comment_lang: row.number_comment_lang || "en",
    issues: row.issues || [],
    notes: row.notes || "",
    notes_lang: row.notes_lang || "en",
    created_at: row.created_at,
  }));
}

export async function saveAnnotation(annotation: LocalAnnotation, status: TaskStatus = 'submitted'): Promise<void> {
  const supabase = await createClient();

  // Upsert annotation (task_id is UNIQUE)
  const { error: annError } = await supabase
    .from("tata_eval_annotations")
    .upsert(
      {
        task_id: annotation.task_id,
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
      { onConflict: "task_id" }
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
  const { data, error } = await supabase
    .from("tata_eval_annotations")
    .select("*")
    .eq("task_id", taskId)
    .maybeSingle();

  if (error) throw new Error(`Failed to get annotation: ${error.message}`);
  if (!data) return null;

  return {
    task_id: data.task_id,
    pron_errors: data.pron_errors || [],
    naturalness: data.naturalness || "",
    naturalness_comment: data.naturalness_comment || "",
    naturalness_comment_lang: data.naturalness_comment_lang || "en",
    emotion: data.emotion || "",
    emotion_comment: data.emotion_comment || "",
    emotion_comment_lang: data.emotion_comment_lang || "en",
    speaker_consistency: data.speaker_consistency || "",
    consistency_comment: data.consistency_comment || "",
    consistency_comment_lang: data.consistency_comment_lang || "en",
    audio_clarity: data.audio_clarity || "",
    clarity_comment: data.clarity_comment || "",
    clarity_comment_lang: data.clarity_comment_lang || "en",
    number_pronunciation: data.number_pronunciation || "",
    number_comment: data.number_comment || "",
    number_comment_lang: data.number_comment_lang || "en",
    issues: data.issues || [],
    notes: data.notes || "",
    notes_lang: data.notes_lang || "en",
    created_at: data.created_at,
  };
}
