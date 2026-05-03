# ClassHub — Agent Instructions

## Stack

Vite + React 19 SPA (NOT Next.js). React Router 7. Supabase (auth, database, storage, realtime). TypeScript strict mode. Tailwind CSS. Vitest + React Testing Library.

**Never suggest `'use client'`, `next/`, or App Router patterns — this is not a Next.js project.**

---

## SE Practices (mandatory — apply to every change)

### Separation of Concerns

- **Pages** (`src/pages/`) — composition and layout only. No raw Supabase calls, no business logic.
- **Hooks** (`src/hooks/`) — all data fetching, state management, and side effects. Return `{ data, loading, error }` plus action methods.
- **Utils** (`src/utils/`) — pure functions only. No React, no Supabase imports.
- **Components** (`src/components/`) — presentational. Receive props, emit events. No direct DB access.
- **Types** (`src/types/index.ts`) — all shared interfaces live here. Never scatter types across files.

If a component is importing Supabase directly, move that logic into a hook first.

### Single Responsibility Principle

- One file = one clear responsibility.
- If you can list more than two reasons to modify a file, it needs to be split.
- Inline sub-components (components defined inside another component's file) are acceptable only when they are small (<40 lines) and exclusively used by that parent. Otherwise extract to their own file.

### File & Function Size Limits

These are enforced by ESLint (warn at threshold, not hard errors — to avoid breaking existing files immediately):

| Unit | Warn at | Goal |
|------|---------|------|
| File | 300 lines | < 250 lines |
| Function/component render | 80 lines | < 60 lines |
| Nesting depth | 4 levels | ≤ 3 levels |
| Cyclomatic complexity | 10 branches | ≤ 8 |

**When editing an existing file that already exceeds a limit:** do not make it worse. Extract at least one responsibility per session when touching a fat file.

**Known oversized files (pre-existing — refactor incrementally, do not rewrite all at once):**

| File | Lines | What to extract next |
|------|-------|----------------------|
| `src/pages/faculty/GradeBook.tsx` | ~953 | ExceptionsPanel → own file |
| `src/pages/student/Quizzes.tsx` | ~696 | PdfQuizSection → own component |
| `src/pages/student/Dashboard.tsx` | ~662 | DashboardWidgets → own components |
| `src/components/quizzes/QuizResults.tsx` | ~619 | ResultsTable → own component |
| `src/pages/faculty/Quizzes.tsx` | ~585 | FileSubmissionSection → own component |
| `src/components/quizzes/QuizBuilder.tsx` | ~527 | QuestionEditor already extracted; extract TimeSelector |

### Modularity

- Prefer editing an existing hook over adding Supabase logic to a component.
- Do not duplicate data transformation logic. If the same shape transformation appears in two hooks, extract it to `src/utils/`.
- Do not add a new util function if a similar one already exists — check `src/utils/` first.

### Cyclomatic Complexity

- Avoid chained ternaries beyond 2 levels. Use early returns or a lookup object instead.
- Avoid `switch` with > 5 cases inside a render function — extract to a util.
- If a function has more than 3 nested `if` blocks, refactor to guard clauses.

---

## Testing

### What must be tested

- **All new util functions** in `src/utils/` must have a corresponding test in `src/utils/__tests__/`.
- **All new hooks** should have at least a smoke test (renders without error, returns expected shape).
- **All new components** with non-trivial conditional rendering should have a test covering each visible branch.

### Test location

```
src/utils/__tests__/         ← pure function tests (existing)
src/hooks/__tests__/         ← hook tests (to be built out)
src/components/__tests__/    ← component tests (to be built out)
```

### Test environment

- Vitest with `environment: 'jsdom'` (set in `vite.config.ts`).
- `@testing-library/react` and `@testing-library/jest-dom` are installed and configured in `src/test/setup.ts`.
- Mock Supabase at the module boundary using `vi.mock('../../lib/supabase')` — never hit the real DB in tests.

### Coverage baseline

Currently ~3–5% (utils only). Target to grow this over time — never let it decrease on new code.

---

## CI/CD

Pipeline: `.github/workflows/ci-cd.yml`

Stages (in order): **type check → lint → test (with coverage) → build**

- Every PR and push to `main` runs all four stages.
- Build stage catches Vite/tree-shaking errors that type check misses.
- Do not skip or comment out stages.
- Supabase env vars are injected from GitHub Secrets (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) — tests and build both need them.

---

## Hooks conventions

- All hooks must be called before any early return in a component (React rules — violated once in GradeBook, caused error #310 in production).
- `useEffect` for async data is intentional — `react-hooks/set-state-in-effect` is disabled project-wide.
- Hooks return a stable object shape: `{ data, loading, error, ...methods }`.

---

## Deploy workflow

Batch all fixes locally before pushing. No single-fix pushes to production. Vercel deploys automatically from `main` via Vercel's GitHub integration (not from CI).

---

## Debugging approach

Diagnose from observed behavior first. Never propose a fix before confirming root cause from evidence (logs, network, DB query). Do not retry failing commands — investigate why they fail.

---

## Scalability / data states

Every UI change must account for empty, partial, and full data states. Never surface misleading metrics (e.g., show 0/0 instead of hiding a ratio entirely when denominator is zero).
