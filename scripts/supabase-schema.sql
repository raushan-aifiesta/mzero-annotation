-- Tata Eval: Tasks table (seeded from CSV)
CREATE TABLE tata_eval_tasks (
  id TEXT PRIMARY KEY,
  language TEXT NOT NULL,
  domain TEXT NOT NULL,
  scenario TEXT NOT NULL,
  user_transcript TEXT NOT NULL,
  agent_transcript TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  is_labeled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tata Eval: Annotations table (one per task, upsert pattern)
CREATE TABLE tata_eval_annotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id TEXT UNIQUE NOT NULL REFERENCES tata_eval_tasks(id),
  pron_errors JSONB DEFAULT '[]',
  naturalness TEXT DEFAULT '',
  naturalness_comment TEXT DEFAULT '',
  naturalness_comment_lang TEXT DEFAULT 'en',
  emotion TEXT DEFAULT '',
  emotion_comment TEXT DEFAULT '',
  emotion_comment_lang TEXT DEFAULT 'en',
  speaker_consistency TEXT DEFAULT '',
  consistency_comment TEXT DEFAULT '',
  consistency_comment_lang TEXT DEFAULT 'en',
  audio_clarity TEXT DEFAULT '',
  clarity_comment TEXT DEFAULT '',
  clarity_comment_lang TEXT DEFAULT 'en',
  number_pronunciation TEXT DEFAULT '',
  number_comment TEXT DEFAULT '',
  number_comment_lang TEXT DEFAULT 'en',
  issues JSONB DEFAULT '[]',
  notes TEXT DEFAULT '',
  notes_lang TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast task lookup
CREATE INDEX idx_tata_eval_annotations_task_id ON tata_eval_annotations(task_id);

-- RLS policies (allow all via anon key — no auth in this app)
ALTER TABLE tata_eval_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tata_eval_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on tata_eval_tasks" ON tata_eval_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on tata_eval_annotations" ON tata_eval_annotations FOR ALL USING (true) WITH CHECK (true);

-- ─── Migration: Status workflow (pending → in_progress → submitted → reviewed) ───
-- Run this in Supabase SQL Editor after initial schema is in place
ALTER TABLE tata_eval_tasks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'
  CHECK (status IN ('pending', 'in_progress', 'submitted', 'reviewed'));

-- Backfill existing data
UPDATE tata_eval_tasks SET status = 'submitted' WHERE is_labeled = true AND (status IS NULL OR status = 'pending');
UPDATE tata_eval_tasks SET status = 'pending' WHERE is_labeled = false AND (status IS NULL);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_tata_eval_tasks_status ON tata_eval_tasks(status);
