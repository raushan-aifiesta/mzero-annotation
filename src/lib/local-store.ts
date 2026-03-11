import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");

export interface LocalProject {
  id: string;
  name: string;
  description: string;
  task_count: number;
  annotated_count: number;
}

export type TaskStatus = 'pending' | 'in_progress' | 'submitted' | 'reviewed' | 'flagged';

export interface LocalTask {
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
  approved_annotation_id?: string;
}

export interface PronError {
  text: string;
  start: number;   // character offset in agent_transcript
  end: number;     // character offset in agent_transcript
  label: string;
  correction: string;
  correction_lang: string;
  error_context: string[];
}

export interface LocalAnnotation {
  task_id: string;
  annotator_id?: string;
  pron_errors: PronError[];
  naturalness: string;
  naturalness_comment: string;
  naturalness_comment_lang: string;
  emotion: string;
  emotion_comment: string;
  emotion_comment_lang: string;
  speaker_consistency: string;
  consistency_comment: string;
  consistency_comment_lang: string;
  audio_clarity: string;
  clarity_comment: string;
  clarity_comment_lang: string;
  number_pronunciation: string;
  number_comment: string;
  number_comment_lang: string;
  issues: string[];
  notes: string;
  notes_lang: string;
  created_at: string;
}

function getAnnotationsPath(): string {
  return join(DATA_DIR, "annotations.json");
}

export function loadTasks(): LocalTask[] {
  const csvPath = join(DATA_DIR, "eval_final.csv");
  if (!existsSync(csvPath)) return [];

  const content = readFileSync(csvPath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  const annotations = loadAnnotations();
  const annotatedIds = new Set(annotations.map((a) => a.task_id));

  // Parse CSV (handle commas in quoted fields)
  const tasks: LocalTask[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 6) continue;
    const [id, language, domain, scenario, user_transcript, agent_transcript] = fields;
    const isLabeled = annotatedIds.has(id);
    tasks.push({
      id,
      language,
      domain,
      scenario,
      user_transcript,
      agent_transcript,
      audio_url: `/audio/${id}.wav`,
      is_labeled: isLabeled,
      status: isLabeled ? 'submitted' : 'pending',
      flagged: false,
    });
  }
  return tasks;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

export function loadAnnotations(): LocalAnnotation[] {
  const path = getAnnotationsPath();
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return [];
  }
}

export function saveAnnotation(annotation: LocalAnnotation): void {
  const annotations = loadAnnotations();
  const idx = annotations.findIndex((a) => a.task_id === annotation.task_id);
  if (idx >= 0) {
    annotations[idx] = annotation;
  } else {
    annotations.push(annotation);
  }
  writeFileSync(getAnnotationsPath(), JSON.stringify(annotations, null, 2));
}

export function getAnnotation(taskId: string): LocalAnnotation | null {
  const annotations = loadAnnotations();
  return annotations.find((a) => a.task_id === taskId) || null;
}
