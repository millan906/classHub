-- Migration 058: Q&A excuse request support
--
-- Adds structured request type and file attachment to the questions table.
-- Students can tag a post as an 'excuse_request' and attach a supporting
-- document (medical cert, excuse letter, etc.) stored in the existing
-- attachments bucket. Faculty see the tag and attachment on the Q&A card.

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS question_type text NOT NULL DEFAULT 'question'
    CHECK (question_type IN ('question', 'excuse_request')),
  ADD COLUMN IF NOT EXISTS attachment_url  text,
  ADD COLUMN IF NOT EXISTS attachment_name text;
