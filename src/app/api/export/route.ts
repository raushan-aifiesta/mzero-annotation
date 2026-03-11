import { NextRequest, NextResponse } from "next/server";
import { loadTasks, loadAnnotations } from "@/lib/store";
import { toLabStudioFormat } from "@/lib/ls-format";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const tasks = await loadTasks();
    const annotations = await loadAnnotations();

    // Group annotations by task_id
    const annotationsByTask = new Map<string, typeof annotations>();
    for (const ann of annotations) {
      const list = annotationsByTask.get(ann.task_id) || [];
      list.push(ann);
      annotationsByTask.set(ann.task_id, list);
    }

    const { searchParams } = new URL(request.url);

    // Info mode: return summary stats
    if (searchParams.get("info") === "1") {
      const reviewedTasks = tasks.filter((t) => t.status === "reviewed");
      const withApproval = reviewedTasks.filter((t) => t.approved_annotation_id);
      const withoutApproval = reviewedTasks.filter((t) => !t.approved_annotation_id);
      const taskAnnotationCounts = reviewedTasks.map((t) => ({
        task_id: t.id,
        annotation_count: annotationsByTask.get(t.id)?.length || 0,
        approved_annotation_id: t.approved_annotation_id || null,
      }));
      const singleAnnotation = taskAnnotationCounts.filter((t) => t.annotation_count === 1);
      const doubleAnnotation = taskAnnotationCounts.filter((t) => t.annotation_count >= 2);

      return NextResponse.json({
        total_tasks: tasks.length,
        reviewed_tasks: reviewedTasks.length,
        total_annotations: annotations.length,
        tasks_with_approval: withApproval.length,
        tasks_without_approval: withoutApproval.map((t) => t.id),
        tasks_with_1_annotation: singleAnnotation.map((t) => t.task_id),
        tasks_with_2_plus_annotations: doubleAnnotation.length,
      });
    }

    // Download mode: ?download=1 triggers file download with only approved annotations
    const download = searchParams.get("download") === "1";

    if (download) {
      const reviewedTasks = tasks.filter((t) => t.status === "reviewed");

      const exported = reviewedTasks.map((task, i) => {
        const taskAnnotations = annotationsByTask.get(task.id) || [];

        // Pick the approved annotation, or fall back to latest
        let approved: typeof taskAnnotations;
        if (task.approved_annotation_id) {
          const match = taskAnnotations.find((a) => a.annotator_id === task.approved_annotation_id);
          approved = match ? [match] : taskAnnotations.slice(-1); // fallback to latest
        } else {
          // No explicit approval — use latest by created_at
          const sorted = [...taskAnnotations].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          approved = sorted.length > 0 ? [sorted[0]] : [];
        }

        return toLabStudioFormat(task, approved, i);
      });

      return NextResponse.json(exported, {
        headers: {
          "Content-Disposition": 'attachment; filename="tata_eval_export.json"',
        },
      });
    }

    // Default: return all tasks with all annotations (for dashboard)
    const exported = tasks.map((task, i) => {
      const taskAnnotations = annotationsByTask.get(task.id) || [];
      return toLabStudioFormat(task, taskAnnotations, i);
    });

    return NextResponse.json(exported);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to export" },
      { status: 500 }
    );
  }
}
