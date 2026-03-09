/**
 * Seed tata_eval_tasks in Supabase from data/eval_final.csv
 *
 * Usage: npx tsx scripts/seed-supabase.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 * in .env.local (or environment).
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load .env.local (Next.js doesn't do this for standalone scripts)
config({ path: join(process.cwd(), ".env.local") });

// ---------- env ----------
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.\n" +
      "Set them in .env.local or export them before running this script."
  );
  process.exit(1);
}

const supabase = createClient(url, key);

// ---------- CSV parser (same logic as local-store.ts) ----------
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

// ---------- main ----------
async function main() {
  const csvPath = join(process.cwd(), "data", "eval_final.csv");
  if (!existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    process.exit(1);
  }

  const content = readFileSync(csvPath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());

  // Check which tasks already have annotations (to set is_labeled)
  const { data: existingAnns } = await supabase
    .from("tata_eval_annotations")
    .select("task_id");
  const annotatedIds = new Set((existingAnns || []).map((a) => a.task_id));

  // Parse CSV rows
  const tasks: Array<{
    id: string;
    language: string;
    domain: string;
    scenario: string;
    user_transcript: string;
    agent_transcript: string;
    audio_url: string;
    is_labeled: boolean;
  }> = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 6) continue;
    const [id, language, domain, scenario, user_transcript, agent_transcript] =
      fields;
    tasks.push({
      id,
      language,
      domain,
      scenario,
      user_transcript,
      agent_transcript,
      audio_url: `/audio/${id}.wav`,
      is_labeled: annotatedIds.has(id),
    });
  }

  console.log(`Parsed ${tasks.length} tasks from CSV.`);

  // Upsert in batches of 50
  const BATCH = 50;
  let upserted = 0;
  for (let i = 0; i < tasks.length; i += BATCH) {
    const batch = tasks.slice(i, i + BATCH);
    const { error } = await supabase
      .from("tata_eval_tasks")
      .upsert(batch, { onConflict: "id" });
    if (error) {
      console.error(`Batch ${i}-${i + batch.length} failed:`, error.message);
      process.exit(1);
    }
    upserted += batch.length;
  }

  console.log(`✅ Upserted ${upserted} tasks into tata_eval_tasks.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
