-- Migration 19: Add attachment fields to quizzes table
-- Faculty can attach a file (PDF, doc, etc.) to any assessment for students to reference

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS attachment_name TEXT;
