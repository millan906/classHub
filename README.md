# ClassHub

A learning management system (LMS) for faculty and students, built with React, TypeScript, and Supabase.

## Features

### Faculty
- **Dashboard** — Grade distribution chart, action alerts (essays to grade, pending approvals, closing assessments), latest assessment stats, per-course filtering
- **Courses** — Create and manage courses with sections; open/close enrollment
- **Students** — Approve/reject enrollment requests, assign courses, view per-student scores, due items, and missed assessments
- **Assessments** — Create and manage quizzes, exams, assignments, labs, and projects; course filter and type grouping; essay grading with automatic gradebook sync
- **Grade Book** — Weighted final grade calculation across configurable grade groups; manual score entry
- **Slides** — Upload and manage course slide decks
- **Q&A** — Answer student questions
- **Announcements** — Post class-wide announcements

### Student
- **Dashboard** — Summary of due/missed assessments and gradebook scores
- **Courses** — View enrolled courses
- **Assessments** — Take quizzes with timed submissions, multiple attempts, and file uploads; view scores grouped by type
- **Slides** — Access course slide decks
- **Q&A** — Post and browse questions
- **Announcements** — View faculty announcements

## Tech Stack

- **Frontend** — React 19, TypeScript, Vite, Tailwind CSS
- **Backend / DB** — Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Email** — Resend
- **Charts** — Recharts
- **Routing** — React Router v7
- **Deployment** — Vercel ([classhub.work](https://classhub.work))

## Getting Started

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env.local` file with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

3. Run the Supabase migrations in order (`SUPABASE_MIGRATIONS.sql` through `SUPABASE_MIGRATIONS_11.sql`) against your Supabase project.

4. Start the dev server:
   ```bash
   npm run dev
   ```

## Edge Functions

Deployed to Supabase. To deploy:

```bash
supabase functions deploy send-announcement-email --no-verify-jwt
supabase functions deploy resolve-role
```

Required Supabase secrets: `RESEND_API_KEY`, `FROM_ADDRESS`, `SUPABASE_SERVICE_ROLE_KEY`, `FACULTY_INVITE_CODE`

## Testing

```bash
npm test
npm run test:coverage
```

## Project Structure

```
src/
├── components/       # Reusable UI and feature components
├── constants/        # Shared constants (item types, etc.)
├── hooks/            # Supabase data hooks
├── pages/            # Faculty and student page views
│   ├── faculty/
│   └── student/
├── utils/            # Grade calculations, score colors
└── types/            # Shared TypeScript types
```
