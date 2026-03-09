import { NextResponse } from "next/server";
import { loadTasks } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tasks = await loadTasks();
    return NextResponse.json(tasks);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load tasks" },
      { status: 500 }
    );
  }
}
