"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function TaskImporter({ projectId }: { projectId: string }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const total = files.length;
    let uploaded = 0;

    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;

        // Upload image to Supabase Storage
        const ext = file.name.split(".").pop();
        const path = `${projectId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("task-images")
          .upload(path, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("task-images")
          .getPublicUrl(path);

        // Create task
        const { error: taskError } = await supabase.from("tasks").insert({
          project_id: projectId,
          data: { image: urlData.publicUrl, original_filename: file.name },
          is_labeled: false,
        });

        if (taskError) throw taskError;

        uploaded++;
        setProgress(`${uploaded}/${total}`);
      }

      router.refresh();
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setUploading(false);
      setProgress("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="mb-8">
      <div className="bg-[var(--bg-secondary)] border border-dashed border-[var(--border)] rounded-xl p-6 text-center hover:border-[var(--accent)] transition">
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleUpload}
          disabled={uploading}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer"
        >
          {uploading ? (
            <p className="text-[var(--text-secondary)]">
              Uploading... {progress}
            </p>
          ) : (
            <>
              <p className="text-[var(--text-secondary)] mb-1">
                Drop images here or click to upload
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                JPG, PNG, WebP — multiple files supported
              </p>
            </>
          )}
        </label>
      </div>
    </div>
  );
}
