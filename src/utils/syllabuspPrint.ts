import type { Course } from '../types'

function cell(c: { text: string; link?: string; file_path?: string; file_name?: string } | undefined, getUrl: (p: string) => string): string {
  if (!c) return '<td></td>'
  const parts: string[] = []
  if (c.text) parts.push(`<span>${c.text}</span>`)
  if (c.file_path) parts.push(`<a href="${getUrl(c.file_path)}" target="_blank">📎 ${c.file_name ?? 'File'}</a>`)
  else if (c.link) parts.push(`<a href="${c.link}" target="_blank">🔗 Link</a>`)
  return `<td>${parts.join('<br>')}</td>`
}

export function printSyllabus(course: Course, getUrl: (p: string) => string) {
  const syllabus = course.syllabus ?? []
  const grading = course.grading_system ?? []

  const syllabusTable = syllabus.length > 0 ? `
    <h2>Course Syllabus</h2>
    <table>
      <thead>
        <tr>
          <th>Week</th>
          <th>Lesson / Topic</th>
          <th>Readings</th>
          <th>Assignments</th>
          <th>Laboratory</th>
        </tr>
      </thead>
      <tbody>
        ${syllabus.map(row => `
          <tr>
            <td>${row.week}</td>
            <td>${row.lesson}</td>
            ${cell(row.readings, getUrl)}
            ${cell(row.assignments, getUrl)}
            ${cell(row.laboratory, getUrl)}
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''

  const gradingTable = grading.length > 0 ? `
    <h2>Grading System</h2>
    <table class="grading">
      <thead><tr><th>Component</th><th>Weight</th></tr></thead>
      <tbody>
        ${grading.map(p => `<tr><td>${p.label}</td><td>${p.weight}%</td></tr>`).join('')}
        <tr class="total"><td><strong>Total</strong></td><td><strong>${grading.reduce((s, p) => s + p.weight, 0)}%</strong></td></tr>
      </tbody>
    </table>
  ` : ''

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${course.name} — Syllabus</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; color: #1a1a1a; padding: 32px 40px; max-width: 960px; margin: auto; }
    h1 { font-size: 18pt; margin-bottom: 2px; }
    .sub { font-size: 11pt; color: #666; margin-bottom: 24px; }
    h2 { font-size: 13pt; border-bottom: 1.5px solid #1D9E75; padding-bottom: 4px; margin-top: 28px; margin-bottom: 12px; color: #0F6E56; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #F1EFE8; font-size: 10pt; font-weight: 600; text-align: left; padding: 7px 10px; border: 0.5px solid #ccc; }
    td { padding: 7px 10px; border: 0.5px solid #ddd; vertical-align: top; font-size: 10pt; line-height: 1.5; }
    table.grading { max-width: 340px; }
    table.grading .total td { background: #E1F5EE; font-weight: 600; }
    a { color: #185FA5; text-decoration: none; }
    @media print { body { padding: 0; } button { display: none; } }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <h1>${course.name}</h1>
      <div class="sub">${course.section ? `Section ${course.section}` : ''}</div>
    </div>
    <button onclick="window.print()" style="padding:8px 18px;background:#1D9E75;color:#fff;border:none;border-radius:8px;font-size:11pt;cursor:pointer;margin-top:8px">
      🖨 Print / Save PDF
    </button>
  </div>
  ${syllabusTable}
  ${gradingTable}
</body>
</html>`

  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}
