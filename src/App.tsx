import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { Layout } from './components/layout/Layout'
import { ErrorBoundary } from './components/ui/ErrorBoundary'

import Login from './pages/auth/Login'
import Register from './pages/auth/Register'

import FacultyDashboard from './pages/faculty/Dashboard'
import FacultySlides from './pages/faculty/Slides'
import FacultyStudents from './pages/faculty/Students'
import FacultyQuizzes from './pages/faculty/Quizzes'
import FacultyQA from './pages/faculty/QA'
import FacultyAnnouncements from './pages/faculty/Announcements'
import FacultyGradeBook from './pages/faculty/GradeBook'
import FacultyCourses from './pages/faculty/Courses'
import FacultySettings from './pages/faculty/Settings'
import FacultyFinalGrades from './pages/faculty/FinalGrades'

import StudentDashboard from './pages/student/Dashboard'
import StudentCourses from './pages/student/Courses'
import StudentSlides from './pages/student/Slides'
import StudentQuizzes from './pages/student/Quizzes'
import StudentQA from './pages/student/QA'
import StudentAnnouncements from './pages/student/Announcements'
import StudentGrades from './pages/student/Grades'

function AppRoutes() {
  const { profile, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ fontSize: '13px', color: '#888' }}>Loading...</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  if (profile.status === 'pending') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', gap: '12px' }}>
        <div style={{ fontSize: '32px' }}>⏳</div>
        <div style={{ fontSize: '17px', fontWeight: 500 }}>Waiting for approval</div>
        <div style={{ fontSize: '13px', color: '#888', maxWidth: '320px' }}>
          Your registration is pending. Your professor will review and approve your request shortly.
        </div>
        <button onClick={signOut} style={{ marginTop: '8px', padding: '6px 16px', fontSize: '12px', borderRadius: '8px', border: '0.5px solid rgba(0,0,0,0.25)', background: 'transparent', cursor: 'pointer' }}>
          Sign out
        </button>
      </div>
    )
  }

  if (profile.status === 'rejected') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', gap: '12px' }}>
        <div style={{ fontSize: '32px' }}>❌</div>
        <div style={{ fontSize: '17px', fontWeight: 500 }}>Access denied</div>
        <div style={{ fontSize: '13px', color: '#888', maxWidth: '320px' }}>
          Your enrollment request was not approved. Please contact your professor.
        </div>
        <button onClick={signOut} style={{ marginTop: '8px', padding: '6px 16px', fontSize: '12px', borderRadius: '8px', border: '0.5px solid rgba(0,0,0,0.25)', background: 'transparent', cursor: 'pointer' }}>
          Sign out
        </button>
      </div>
    )
  }

  const isFaculty = profile.role === 'faculty'

  return (
    <Layout profile={profile} onSignOut={signOut}>
      <Routes>
        {isFaculty ? (
          <>
            <Route path="/faculty/dashboard" element={<FacultyDashboard />} />
            <Route path="/faculty/slides" element={<FacultySlides />} />
            <Route path="/faculty/students" element={<FacultyStudents />} />
            <Route path="/faculty/quizzes" element={<FacultyQuizzes />} />
            <Route path="/faculty/qa" element={<FacultyQA />} />
            <Route path="/faculty/announcements" element={<FacultyAnnouncements />} />
            <Route path="/faculty/gradebook" element={<FacultyGradeBook />} />
            <Route path="/faculty/courses" element={<FacultyCourses />} />
            <Route path="/faculty/settings" element={<FacultySettings />} />
            <Route path="/faculty/final-grades" element={<FacultyFinalGrades />} />
            <Route path="*" element={<Navigate to="/faculty/dashboard" replace />} />
          </>
        ) : (
          <>
            <Route path="/student/dashboard" element={<StudentDashboard />} />
            <Route path="/student/slides" element={<StudentSlides />} />
            <Route path="/student/quizzes" element={<StudentQuizzes />} />
            <Route path="/student/qa" element={<StudentQA />} />
            <Route path="/student/announcements" element={<StudentAnnouncements />} />
            <Route path="/student/courses" element={<StudentCourses />} />
            <Route path="/student/grades" element={<StudentGrades />} />
            <Route path="*" element={<Navigate to="/student/dashboard" replace />} />
          </>
        )}
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  )
}
