-- Migration 15: Essay rubric + essay_scores on submissions

-- Add essay_scores column to existing submissions table
ALTER TABLE public.pdf_quiz_submissions
  ADD COLUMN IF NOT EXISTS essay_scores jsonb NOT NULL DEFAULT '{}';

-- Essay rubric: one row per scoring category per essay question
-- e.g. Q21 might have: "Content" 15pts, "Analysis" 10pts, "Clarity" 5pts
CREATE TABLE public.pdf_quiz_essay_rubric (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdf_quiz_id   uuid REFERENCES public.pdf_quizzes(id) ON DELETE CASCADE NOT NULL,
  question_number int NOT NULL,
  category_name text NOT NULL,
  max_points    int NOT NULL DEFAULT 5,
  order_index   int NOT NULL DEFAULT 0
);

ALTER TABLE public.pdf_quiz_essay_rubric ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read essay rubric"
  ON public.pdf_quiz_essay_rubric FOR SELECT TO authenticated USING (true);

CREATE POLICY "Faculty can insert essay rubric"
  ON public.pdf_quiz_essay_rubric FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.pdf_quizzes WHERE id = pdf_quiz_id AND created_by = auth.uid())
  );

CREATE POLICY "Faculty can update essay rubric"
  ON public.pdf_quiz_essay_rubric FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.pdf_quizzes WHERE id = pdf_quiz_id AND created_by = auth.uid())
  );

CREATE POLICY "Faculty can delete essay rubric"
  ON public.pdf_quiz_essay_rubric FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.pdf_quizzes WHERE id = pdf_quiz_id AND created_by = auth.uid())
  );
