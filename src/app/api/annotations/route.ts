import { NextResponse } from "next/server";
import { saveAnnotation } from "@/lib/store";
import type { LocalAnnotation, TaskStatus } from "@/lib/local-store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const status: TaskStatus = body.status || "submitted";
    const annotation: LocalAnnotation = {
      task_id: body.task_id,
      pron_errors: body.pron_errors || [],
      naturalness: body.naturalness || "",
      naturalness_comment: body.naturalness_comment || "",
      naturalness_comment_lang: body.naturalness_comment_lang || "en",
      emotion: body.emotion || "",
      emotion_comment: body.emotion_comment || "",
      emotion_comment_lang: body.emotion_comment_lang || "en",
      speaker_consistency: body.speaker_consistency || "",
      consistency_comment: body.consistency_comment || "",
      consistency_comment_lang: body.consistency_comment_lang || "en",
      audio_clarity: body.audio_clarity || "",
      clarity_comment: body.clarity_comment || "",
      clarity_comment_lang: body.clarity_comment_lang || "en",
      number_pronunciation: body.number_pronunciation || "",
      number_comment: body.number_comment || "",
      number_comment_lang: body.number_comment_lang || "en",
      issues: body.issues || [],
      notes: body.notes || "",
      notes_lang: body.notes_lang || "en",
      created_at: new Date().toISOString(),
    };
    await saveAnnotation(annotation, status);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
