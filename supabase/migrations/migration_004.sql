-- Migration 4: Course enrollments (faculty invite → student tied to course)

CREATE TABLE IF NOT EXISTS course_enrollments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, student_id)
);

ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;

-- Faculty can manage enrollments they created
CREATE POLICY "Faculty can manage enrollments"
  ON course_enrollments FOR ALL
  USING (auth.uid() = invited_by);

-- Students can view their own enrollments
CREATE POLICY "Students can view own enrollments"
  ON course_enrollments FOR SELECT
  USING (auth.uid() = student_id);
