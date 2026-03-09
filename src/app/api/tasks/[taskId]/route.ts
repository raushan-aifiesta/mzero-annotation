import { NextResponse } from "next/server";
import { loadTasks, getAnnotation, updateTaskStatus } from "@/lib/store";
import type { TaskStatus } from "@/lib/local-store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const tasks = await loadTasks();
    const task = tasks.find((t) => t.id === taskId);
    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const annotation = await getAnnotation(taskId);
    return NextResponse.json({ task, annotation });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const body = await request.json();

    // Handle flagged toggle
    if (typeof body.flagged === 'boolean') {
      const { toggleTaskFlag } = await import("@/lib/store");
      await toggleTaskFlag(taskId, body.flagged);
      return NextResponse.json({ success: true });
    }

    // Handle status update
    const status = body.status as TaskStatus;
    if (!status || !['pending', 'in_progress', 'submitted', 'reviewed', 'flagged'].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    await updateTaskStatus(taskId, status);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
