import type { PdfQuiz } from '../types'

const SECTION_LABELS: Record<string, string> = {
  truefalse: 'TRUE OR FALSE',
  mcq: 'MULTIPLE CHOICE',
  text: 'SHORT ANSWER',
  essay: 'ESSAY',
}

const SECTION_INSTRUCTIONS: Record<string, string> = {
  truefalse: 'Write <strong>T</strong> if the statement is true and <strong>F</strong> if the statement is false.',
  mcq: 'Write the letter of the best answer: <strong>A</strong>, <strong>B</strong>, <strong>C</strong>, or <strong>D</strong>.',
  text: 'Write your answer clearly in the space provided.',
  essay: 'Score each category for the corresponding essay question.',
}

export function printAnswerSheet(quiz: PdfQuiz) {
  const key = [...(quiz.answer_key ?? [])].sort((a, b) => a.question_number - b.question_number)
  const rubrics = quiz.essay_rubrics ?? []

  // Group consecutive questions by type, preserving question number order
  type Section = { type: string; questions: typeof key }
  const sections: Section[] = []
  for (const entry of key) {
    const last = sections[sections.length - 1]
    if (last && last.type === entry.question_type) {
      last.questions.push(entry)
    } else {
      sections.push({ type: entry.question_type, questions: [entry] })
    }
  }

  // Calculate section point totals
  function sectionPoints(s: Section) {
    return s.questions.reduce((sum, q) => sum + q.points, 0)
  }

  function buildObjectiveGrid(questions: typeof key) {
    const rows: string[] = []
    for (let i = 0; i < questions.length; i += 4) {
      const chunk = questions.slice(i, i + 4)
      const cells = chunk.map(q => `
        <td style="padding:6px 10px;text-align:center;vertical-align:bottom;">
          <div style="
            width:52px;height:52px;border:2px solid #222;border-radius:4px;
            margin:0 auto 4px;display:flex;align-items:center;justify-content:center;
            font-size:20px;font-family:monospace;
          ">&nbsp;</div>
          <div style="font-size:12px;font-weight:600;">${q.question_number}.</div>
        </td>
      `).join('')
      rows.push(`<tr>${cells}</tr>`)
    }
    return `<table style="border-collapse:collapse;margin-bottom:4px;">${rows.join('')}</table>`
  }

  function buildEssaySection(questions: typeof key) {
    return questions.map(q => {
      const cats = rubrics
        .filter(r => r.question_number === q.question_number)
        .sort((a, b) => a.order_index - b.order_index)

      const rubricRows = cats.map(c => `
        <tr>
          <td style="padding:5px 10px;font-size:12px;border:1px solid #ccc;">${c.category_name}</td>
          <td style="padding:5px 10px;font-size:12px;border:1px solid #ccc;text-align:center;">${c.max_points}</td>
          <td style="padding:5px 10px;border:1px solid #ccc;width:60px;">&nbsp;</td>
        </tr>
      `).join('')

      return `
        <div style="margin-bottom:20px;">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px;">
            Question ${q.question_number} &nbsp;<span style="font-weight:400;color:#555;">(${q.points} pts)</span>
          </div>
          ${cats.length > 0 ? `
            <table style="border-collapse:collapse;width:360px;">
              <thead>
                <tr style="background:#f4f4f4;">
                  <th style="padding:5px 10px;font-size:11px;border:1px solid #ccc;text-align:left;">Category</th>
                  <th style="padding:5px 10px;font-size:11px;border:1px solid #ccc;">Max</th>
                  <th style="padding:5px 10px;font-size:11px;border:1px solid #ccc;">Score</th>
                </tr>
              </thead>
              <tbody>${rubricRows}</tbody>
              <tfoot>
                <tr style="background:#f4f4f4;">
                  <td colspan="2" style="padding:5px 10px;font-size:12px;font-weight:600;border:1px solid #ccc;">Total</td>
                  <td style="border:1px solid #ccc;">&nbsp;</td>
                </tr>
              </tfoot>
            </table>
          ` : '<div style="font-size:12px;color:#888;">No rubric defined.</div>'}
        </div>
      `
    }).join('')
  }

  const sectionsHtml = sections.map((s, idx) => {
    const label = SECTION_LABELS[s.type] ?? s.type.toUpperCase()
    const instruction = SECTION_INSTRUCTIONS[s.type] ?? ''
    const pts = sectionPoints(s)
    const partNum = ['I', 'II', 'III', 'IV', 'V', 'VI'][idx] ?? String(idx + 1)
    const content = s.type === 'essay'
      ? buildEssaySection(s.questions)
      : buildObjectiveGrid(s.questions)

    return `
      <div style="margin-bottom:28px;page-break-inside:avoid;">
        <div style="font-size:14px;font-weight:700;margin-bottom:4px;">
          PART ${partNum} – ${label} (${pts} pts)
        </div>
        <div style="font-size:12px;margin-bottom:14px;">${instruction}</div>
        ${content}
      </div>
    `
  }).join('')

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Answer Sheet – ${quiz.title}</title>
  <style>
    @page { size: letter portrait; margin: 0.75in; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 13px; color: #111; margin: 0; }
    @media print { body { -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div style="text-align:center;font-size:15px;font-weight:700;margin-bottom:4px;">ANSWER SHEET</div>
  <div style="text-align:center;font-size:13px;margin-bottom:16px;">${quiz.title}</div>

  <div style="border-bottom:1px solid #000;padding-bottom:12px;margin-bottom:20px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:4px 0;width:55%;">
          Name: <span style="display:inline-block;width:220px;border-bottom:1px solid #000;">&nbsp;</span>
        </td>
        <td style="padding:4px 0;width:25%;">
          Section: <span style="display:inline-block;width:80px;border-bottom:1px solid #000;">&nbsp;</span>
        </td>
        <td style="padding:4px 0;width:20%;">
          Date: <span style="display:inline-block;width:80px;border-bottom:1px solid #000;">&nbsp;</span>
        </td>
      </tr>
    </table>
  </div>

  ${sectionsHtml}

  <div style="margin-top:32px;border-top:1px solid #ccc;padding-top:10px;text-align:right;font-size:11px;color:#555;">
    Total Score: ________ / ${quiz.total_points}
  </div>
</body>
</html>
  `

  const win = window.open('', '_blank', 'width=850,height=1100')
  if (!win) { alert('Please allow popups to print the answer sheet.'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 400)
}
