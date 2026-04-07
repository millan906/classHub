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
}

export interface Course {
  id: string
  name: string
  section?: string
  status: 'open' | 'closed'
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
}

export interface QuizFormData {
  title: string
  courseId: string | null
  slideId: string | null
  dueDate: string | null
  timeLimitMinutes: number | null
  lockdownEnabled: boolean
  maxAttempts: number
  questions: Omit<QuizQuestion, 'id' | 'quiz_id'>[]
  itemType: ItemType
  gradeGroupId: string | null
  allowFileUpload: boolean
  description: string | null
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
