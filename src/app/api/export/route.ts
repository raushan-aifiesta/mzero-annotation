import { NextResponse } from "next/server";
import { loadTasks, loadAnnotations } from "@/lib/store";
import { toLabStudioFormat } from "@/lib/ls-format";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tasks = await loadTasks();
    const annotations = await loadAnnotations();

    const exported = tasks.map((task, i) => {
      const ann = annotations.find((a) => a.task_id === task.id) || null;
      return toLabStudioFormat(task, ann, i);
    });

    return NextResponse.json(exported);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to export" },
      { status: 500 }
    );
  }
}
