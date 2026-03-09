"use client";

import Link from "next/link";
import type { Task } from "@/lib/types";

interface TaskListProps {
  tasks: (Task & { annotations: { count: number }[] })[];
  projectId: string;
}

export default function TaskList({ tasks, projectId }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--text-secondary)]">
        <p>No tasks yet. Import images above to get started.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">
        Tasks ({tasks.length})
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {tasks.map((task, index) => (
          <Link
            key={task.id}
            href={`/projects/${projectId}/annotate/${task.id}`}
            className="group bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg overflow-hidden hover:border-[var(--accent)] transition"
          >
            <div className="aspect-square relative bg-[var(--bg-tertiary)]">
              {task.data.image ? (
                <img
                  src={task.data.image}
                  alt={`Task ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[var(--text-secondary)] text-xs">
                  No preview
                </div>
              )}
              {task.is_labeled && (
                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[var(--success)] flex items-center justify-center text-[10px] text-white">
                  ✓
                </div>
              )}
            </div>
            <div className="p-2">
              <p className="text-xs text-[var(--text-secondary)] truncate">
                #{index + 1}
                {task.annotations?.[0]?.count
                  ? ` · ${task.annotations[0].count} ann.`
                  : ""}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
