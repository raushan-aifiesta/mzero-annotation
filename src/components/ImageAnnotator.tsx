"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Project, Task, BBoxValue } from "@/lib/types";

interface AnnotationBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color: string;
}

interface ImageAnnotatorProps {
  task: Task & { annotations: Array<{ id: string; result: Array<{ value: BBoxValue; from_name: string; to_name: string; type: string }> }> };
  project: Project;
  nextTaskId: string | null;
}

export default function ImageAnnotator({
  task,
  project,
  nextTaskId,
}: ImageAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [boxes, setBoxes] = useState<AnnotationBox[]>([]);
  const [selectedLabel, setSelectedLabel] = useState(
    project.label_config.labels[0]?.name || ""
  );
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentPoint, setCurrentPoint] = useState<{ x: number; y: number } | null>(null);
  const [selectedBox, setSelectedBox] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const router = useRouter();
  const supabase = createClient();
  const labels = project.label_config.labels;

  // Load existing annotations
  useEffect(() => {
    if (task.annotations && task.annotations.length > 0) {
      const existing = task.annotations[0];
      const loadedBoxes: AnnotationBox[] = existing.result
        .filter((r) => r.type === "rectanglelabels")
        .map((r) => {
          const v = r.value as BBoxValue;
          const labelName = v.rectanglelabels?.[0] || "";
          const labelConfig = labels.find((l) => l.name === labelName);
          return {
            id: crypto.randomUUID(),
            x: v.x,
            y: v.y,
            width: v.width,
            height: v.height,
            label: labelName,
            color: labelConfig?.color || "#EF4444",
          };
        });
      setBoxes(loadedBoxes);
    }
  }, [task.annotations, labels]);

  // Load image
  useEffect(() => {
    if (!task.data.image) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.src = task.data.image;
  }, [task.data.image]);

  // Fit image to container and draw
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const img = imageRef.current;
    if (!canvas || !container || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    canvas.width = containerWidth;
    canvas.height = containerHeight;

    // Fit image
    const scaleX = containerWidth / img.width;
    const scaleY = containerHeight / img.height;
    const s = Math.min(scaleX, scaleY, 1);
    setScale(s);

    const ox = (containerWidth - img.width * s) / 2;
    const oy = (containerHeight - img.height * s) / 2;
    setOffset({ x: ox, y: oy });

    // Clear and draw image
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, containerWidth, containerHeight);
    ctx.drawImage(img, ox, oy, img.width * s, img.height * s);

    // Draw existing boxes
    boxes.forEach((box) => {
      const bx = ox + (box.x / 100) * img.width * s;
      const by = oy + (box.y / 100) * img.height * s;
      const bw = (box.width / 100) * img.width * s;
      const bh = (box.height / 100) * img.height * s;

      ctx.strokeStyle = box.color;
      ctx.lineWidth = selectedBox === box.id ? 3 : 2;
      ctx.strokeRect(bx, by, bw, bh);

      // Label background
      ctx.fillStyle = box.color;
      const textMetrics = ctx.measureText(box.label);
      const textHeight = 16;
      const padding = 4;
      ctx.fillRect(
        bx,
        by - textHeight - padding,
        textMetrics.width + padding * 2,
        textHeight + padding
      );

      // Label text
      ctx.fillStyle = "#fff";
      ctx.font = "12px system-ui";
      ctx.fillText(box.label, bx + padding, by - padding);

      // Semi-transparent fill
      ctx.fillStyle = box.color + "20";
      ctx.fillRect(bx, by, bw, bh);
    });

    // Draw current drawing box
    if (isDrawing && startPoint && currentPoint) {
      const label = labels.find((l) => l.name === selectedLabel);
      ctx.strokeStyle = label?.color || "#EF4444";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(
        startPoint.x,
        startPoint.y,
        currentPoint.x - startPoint.x,
        currentPoint.y - startPoint.y
      );
      ctx.setLineDash([]);
    }
  }, [boxes, isDrawing, startPoint, currentPoint, selectedBox, selectedLabel, labels]);

  useEffect(() => {
    if (imageLoaded) {
      draw();
    }
  }, [imageLoaded, draw]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  function canvasToPercent(cx: number, cy: number) {
    const img = imageRef.current;
    if (!img) return { x: 0, y: 0 };
    const px = ((cx - offset.x) / (img.width * scale)) * 100;
    const py = ((cy - offset.y) / (img.height * scale)) * 100;
    return { x: px, y: py };
  }

  function handleMouseDown(e: React.MouseEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking on existing box
    const img = imageRef.current;
    if (img) {
      for (let i = boxes.length - 1; i >= 0; i--) {
        const box = boxes[i];
        const bx = offset.x + (box.x / 100) * img.width * scale;
        const by = offset.y + (box.y / 100) * img.height * scale;
        const bw = (box.width / 100) * img.width * scale;
        const bh = (box.height / 100) * img.height * scale;

        if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
          setSelectedBox(box.id);
          return;
        }
      }
    }

    setSelectedBox(null);
    setIsDrawing(true);
    setStartPoint({ x, y });
    setCurrentPoint({ x, y });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setCurrentPoint({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }

  function handleMouseUp() {
    if (!isDrawing || !startPoint || !currentPoint) {
      setIsDrawing(false);
      return;
    }

    const p1 = canvasToPercent(startPoint.x, startPoint.y);
    const p2 = canvasToPercent(currentPoint.x, currentPoint.y);

    const x = Math.min(p1.x, p2.x);
    const y = Math.min(p1.y, p2.y);
    const width = Math.abs(p2.x - p1.x);
    const height = Math.abs(p2.y - p1.y);

    // Minimum size check
    if (width > 0.5 && height > 0.5) {
      const label = labels.find((l) => l.name === selectedLabel);
      const newBox: AnnotationBox = {
        id: crypto.randomUUID(),
        x,
        y,
        width,
        height,
        label: selectedLabel,
        color: label?.color || "#EF4444",
      };
      setBoxes((prev) => [...prev, newBox]);
    }

    setIsDrawing(false);
    setStartPoint(null);
    setCurrentPoint(null);
  }

  function deleteSelected() {
    if (!selectedBox) return;
    setBoxes((prev) => prev.filter((b) => b.id !== selectedBox));
    setSelectedBox(null);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const result = boxes.map((box) => ({
        type: "rectanglelabels" as const,
        from_name: "label",
        to_name: "image",
        value: {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          rectanglelabels: [box.label],
        },
      }));

      // Delete existing annotations for this task
      if (task.annotations && task.annotations.length > 0) {
        await supabase
          .from("annotations")
          .delete()
          .eq("task_id", task.id);
      }

      // Insert new annotation
      const { error } = await supabase.from("annotations").insert({
        task_id: task.id,
        result,
        created_by: user.id,
      });

      if (error) throw error;

      // Mark task as labeled
      await supabase
        .from("tasks")
        .update({ is_labeled: boxes.length > 0 })
        .eq("id", task.id);

      // Navigate to next task
      if (nextTaskId) {
        router.push(
          `/projects/${task.project_id}/annotate/${nextTaskId}`
        );
      } else {
        router.push(`/projects/${task.project_id}`);
      }
      router.refresh();
    } catch (err) {
      alert("Save failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Delete" || e.key === "Backspace") {
        deleteSelected();
      }
      // Number keys to select labels
      const num = parseInt(e.key);
      if (num >= 1 && num <= labels.length) {
        setSelectedLabel(labels[num - 1].name);
      }
      // S to save
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div className="flex h-full">
      {/* Canvas area */}
      <div ref={containerRef} className="flex-1 relative">
        <canvas
          ref={canvasRef}
          className="annotation-canvas absolute inset-0"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>

      {/* Right panel */}
      <div className="w-64 bg-[var(--bg-secondary)] border-l border-[var(--border)] flex flex-col">
        {/* Labels */}
        <div className="p-3 border-b border-[var(--border)]">
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">
            Labels
          </h3>
          <div className="space-y-1">
            {labels.map((label, i) => (
              <button
                key={label.name}
                onClick={() => setSelectedLabel(label.name)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition text-left ${
                  selectedLabel === label.name
                    ? "bg-[var(--bg-tertiary)] text-white"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                }`}
              >
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ background: label.color }}
                />
                <span className="truncate">{label.name}</span>
                <span className="ml-auto text-xs text-[var(--text-secondary)]">
                  {i + 1}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Annotations list */}
        <div className="flex-1 p-3 overflow-y-auto">
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">
            Regions ({boxes.length})
          </h3>
          <div className="space-y-1">
            {boxes.map((box, i) => (
              <div
                key={box.id}
                onClick={() => setSelectedBox(box.id)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer transition ${
                  selectedBox === box.id
                    ? "bg-[var(--bg-tertiary)] text-white"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ background: box.color }}
                />
                <span className="truncate">
                  #{i + 1} {box.label}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setBoxes((prev) => prev.filter((b) => b.id !== box.id));
                    if (selectedBox === box.id) setSelectedBox(null);
                  }}
                  className="ml-auto text-[var(--text-secondary)] hover:text-red-400 text-xs"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="p-3 border-t border-[var(--border)] space-y-2">
          {selectedBox && (
            <button
              onClick={deleteSelected}
              className="w-full py-1.5 border border-red-800 text-red-400 rounded-lg text-sm hover:bg-red-900/30 transition"
            >
              Delete Selected
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium rounded-lg text-sm transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Submit (⌘S)"}
          </button>
          <p className="text-[10px] text-[var(--text-secondary)] text-center">
            1-9: select label · Del: remove · ⌘S: save
          </p>
        </div>
      </div>
    </div>
  );
}
