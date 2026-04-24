export type Role = 'faculty' | 'student'
export type Status = 'pending' | 'approved' | 'rejected'

export interface Profile {
  id: string
  first_name: string
  last_name: string
  full_name: string
  email: string
  role: Role
  status: Status
  created_at: string
  avatar_seed?: string | null
  student_no?: string | null
  program?: string | null
  section?: string | null
}

export interface SyllabusCell {
  text: string
  link?: string
  file_path?: string
  file_name?: string
}

export interface SyllabusRow {
  id: string
  week: string
  lesson: string
  readings: SyllabusCell
  assignments: SyllabusCell
  laboratory: SyllabusCell
}

export interface GradingPeriod {
  label: string   // e.g. "Prelim", "Midterm", "Finals"
  weight: number  // percentage, should sum to 100
}

export interface CourseScheduleItem {
  id: string
  type: 'lecture' | 'lab' | 'other'
  day: string    // e.g. "Mon & Wed", "Tuesday"
  time: string   // e.g. "8:00 AM – 10:00 AM"
  room?: string
}

export interface CourseResource {
  id: string
  title: string
  category: 'book' | 'journal' | 'lab' | 'other'
  link?: string        // external URL
  file_path?: string   // Supabase Storage path
  file_name?: string   // original filename for display
}

export interface Course {
  id: string
  name: string
  section?: string
  status: 'open' | 'closed'
  topics?: string[]
  syllabus?: SyllabusRow[]
  schedule?: CourseScheduleItem[]
  resources?: CourseResource[]
  grading_system?: GradingPeriod[]
  grades_visible?: boolean
  created_by: string
  created_at: string
}

export interface Slide {
  id: string
  title: string
  file_path: string
  file_size_mb: number
  slide_count: number
  uploaded_by: string
  created_at: string
  course_id?: string | null
}

export interface Announcement {
  id: string
  title: string
  body: string
  posted_by: string
  created_at: string
  course_id?: string | null
}

export type ItemType = 'quiz' | 'lab' | 'assignment' | 'project' | 'exam'

export interface Quiz {
  id: string
  title: string
  slide_id?: string
  due_date?: string
  open_at?: string | null
  close_at?: string | null
  is_open: boolean
  created_by: string
  created_at: string
  questions?: QuizQuestion[]
  course?: string
  course_id?: string | null
  time_limit_minutes?: number
  lockdown_enabled?: boolean
  max_attempts?: number
  item_type?: ItemType
  allow_file_upload?: boolean
  description?: string | null
  grade_group_id?: string | null
  results_visible?: boolean
  attachment_url?: string | null
  attachment_name?: string | null
  randomize_questions?: boolean
  file_max_points?: number | null
}

export interface QuizQuestion {
  id: string
  quiz_id: string
  question_text: string
  options: { label: string; text: string }[]
  correct_option: string
  order_index: number
  type?: 'mcq' | 'truefalse' | 'codesnippet' | 'essay'
  code_snippet?: string
  code_language?: string
  points?: number
}

export interface QuizSubmission {
  id: string
  quiz_id: string
  student_id: string
  answers: Record<string, string>
  score: number
  submitted_at: string
  started_at?: string
  auto_submitted?: boolean
  attempt_number?: number
  earned_points?: number
  total_points?: number
  essay_scores?: Record<string, number>
  keystroke_count?: number
  answer_timestamps?: Record<string, string>
}

export interface QuizFormData {
  title: string
  courseId: string | null
  slideId: string | null
  dueDate: string | null
  openAt: string | null
  closeAt: string | null
  timeLimitMinutes: number | null
  lockdownEnabled: boolean
  maxAttempts: number
  questions: Omit<QuizQuestion, 'id' | 'quiz_id'>[]
  itemType: ItemType
  gradeGroupId: string | null
  allowFileUpload: boolean
  description: string | null
  notifyStudents: boolean
  attachmentUrl: string | null
  attachmentName: string | null
  randomizeQuestions: boolean
  fileMaxPoints: number | null
}

export interface FileSubmission {
  id: string
  quiz_id: string
  student_id: string
  file_url: string
  file_name: string
  file_size?: number
  submitted_at: string
}

export interface IntegrityLog {
  id: string
  quiz_id: string
  student_id: string
  event_type: string
  severity: 'low' | 'medium' | 'high'
  occurred_at: string
}

export interface Question {
  id: string
  title: string
  body: string
  tag?: string
  posted_by: string
  is_answered: boolean
  created_at: string
  updated_at?: string
  poster?: Profile
  answers?: Answer[]
}

export interface Answer {
  id: string
  question_id: string
  body: string
  posted_by: string
  is_endorsed: boolean
  created_at: string
  poster?: Profile
}

export type PdfQuizQuestionType = 'mcq' | 'truefalse' | 'text' | 'essay'

export interface PdfQuizAnswerKeyEntry {
  id: string
  pdf_quiz_id: string
  question_number: number
  question_type: PdfQuizQuestionType
  correct_answer: string
  points: number
}

export interface PdfQuizEssayRubric {
  id: string
  pdf_quiz_id: string
  question_number: number
  category_name: string
  max_points: number
  order_index: number
}

export interface PdfQuiz {
  id: string
  title: string
  course_id: string | null
  grade_group_id: string | null
  pdf_path: string | null
  due_date: string | null
  open_at?: string | null
  close_at?: string | null
  is_open: boolean
  max_attempts: number
  num_questions: number
  total_points: number
  created_by: string
  created_at: string
  instructions?: string | null
  answer_key?: PdfQuizAnswerKeyEntry[]
  essay_rubrics?: PdfQuizEssayRubric[]
  results_visible?: boolean
}

export interface PdfQuizSubmission {
  id: string
  pdf_quiz_id: string
  student_id: string
  answers: Record<string, string>
  earned_points: number
  score: number
  attempt_number: number
  submitted_at: string
  // essay_scores: { [question_number]: { [rubric_id]: earned_points } }
  essay_scores: Record<string, Record<string, number>>
}

export interface PdfQuizFormData {
  title: string
  courseId: string | null
  gradeGroupId: string | null
  dueDate: string | null
  openAt: string | null
  closeAt: string | null
  maxAttempts: number
  notifyStudents: boolean
  instructions: string | null
  answerKey: {
    question_number: number
    question_type: PdfQuizQuestionType
    correct_answer: string
    points: number
  }[]
  rubrics: {
    question_number: number
    categories: { category_name: string; max_points: number; order_index: number }[]
  }[]
}

// ── Gradebook ─────────────────────────────────────────────────────────────────

export interface GradeGroup {
  id: string
  name: string
  weight_percent: number
  created_by: string
  created_at: string
  course_id?: string | null
}

export interface GradeColumn {
  id: string
  title: string
  category: string | null
  max_score: number
  group_id: string
  entry_type: 'manual' | 'quiz_linked'
  linked_quiz_id: string | null
  description: string | null
  created_by: string
  created_at: string
  course_id?: string | null
}

export interface GradeEntry {
  id: string
  column_id: string
  student_id: string
  score: number | null
}

// ── Attendance ────────────────────────────────────────────────────────────────

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused'

export interface AttendanceSession {
  id: string
  course_id: string
  label: string
  date: string
  created_by: string
  created_at: string
}

export interface AttendanceRecord {
  id: string
  session_id: string
  student_id: string
  status: AttendanceStatus
  created_at: string
}
