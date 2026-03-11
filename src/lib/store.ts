/**
 * Unified store: uses Supabase when env vars are set, falls back to local JSON.
 */
import type { LocalTask, LocalAnnotation, TaskStatus } from "./local-store";

function useSupabase(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function loadTasks(): Promise<LocalTask[]> {
  if (useSupabase()) {
    const { loadTasks } = await import("./supabase-store");
    return loadTasks();
  }
  const { loadTasks } = await import("./local-store");
  return loadTasks();
}

export async function loadAnnotations(): Promise<LocalAnnotation[]> {
  if (useSupabase()) {
    const { loadAnnotations } = await import("./supabase-store");
    return loadAnnotations();
  }
  const { loadAnnotations } = await import("./local-store");
  return loadAnnotations();
}

export async function saveAnnotation(annotation: LocalAnnotation, status: TaskStatus = 'submitted'): Promise<void> {
  if (useSupabase()) {
    const { saveAnnotation } = await import("./supabase-store");
    return saveAnnotation(annotation, status);
  }
  const { saveAnnotation } = await import("./local-store");
  saveAnnotation(annotation);
}

export async function getAnnotation(taskId: string): Promise<LocalAnnotation | null> {
  if (useSupabase()) {
    const { getAnnotation } = await import("./supabase-store");
    return getAnnotation(taskId);
  }
  const { getAnnotation } = await import("./local-store");
  return getAnnotation(taskId);
}

export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
  if (useSupabase()) {
    const { updateTaskStatus } = await import("./supabase-store");
    return updateTaskStatus(taskId, status);
  }
  // Local store: no-op (status is derived from annotations)
}

export async function toggleTaskFlag(taskId: string, flagged: boolean): Promise<void> {
  if (useSupabase()) {
    const { toggleTaskFlag } = await import("./supabase-store");
    return toggleTaskFlag(taskId, flagged);
  }
  // Local store: no-op
}

export async function approveAnnotation(taskId: string, annotatorId: string): Promise<void> {
  if (useSupabase()) {
    const { approveAnnotation } = await import("./supabase-store");
    return approveAnnotation(taskId, annotatorId);
  }
  // Local store: no-op
}

export async function getAnnotationsForTask(taskId: string): Promise<LocalAnnotation[]> {
  if (useSupabase()) {
    const { getAnnotationsForTask } = await import("./supabase-store");
    return getAnnotationsForTask(taskId);
  }
  const { loadAnnotations } = await import("./local-store");
  return loadAnnotations().filter((a) => a.task_id === taskId);
}
