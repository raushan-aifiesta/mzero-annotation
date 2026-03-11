-- Add approved_annotation_id to track which annotation was accepted during review
-- Run this in the Supabase SQL Editor
-- SAFE: only adds a new nullable column, does NOT modify existing data

ALTER TABLE tata_eval_tasks ADD COLUMN IF NOT EXISTS approved_annotation_id TEXT;
