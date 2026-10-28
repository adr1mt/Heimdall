import type { CheckResult, RunResult, StudentResult } from '../../../shared/artifact'
import type { AcademicStatus } from '../../../shared/events'
import { readExam } from '../../../shared/exam'
import { CAUSE_TEXT, dateText } from './results'
import { toScale, type Scale } from './scale'

/**
 * One page per student, left on their own machine (T185, T188).
 *
 * It is read from the artifact and nothing else, and it takes only what the
 * student is meant to see: who they are, the exam, the grade in the teacher's
 * scale and, check by check, the teacher's own description and how it went.
 * Commands, outputs, expected values, technical details and every other
 * student stay out on purpose. The page is built from a whitelist, so a field
 * the artifact grows tomorrow cannot leak into it either.
 *
 * A check nobody could look at is written as «no se pudo comprobar», never as
 * a failure: a machine that did not answer is not a wrong answer (principio 3).
 */

/** The students that get a report: whoever took part in this correction. */
export function reportStudents(run: RunResult): StudentResult[] {
  return run.students.filter((student) => student.status !== 'EXCLUDED')
}

/** Every student's page, by student_id: each one goes to that student only. */
export function studentReports(run: RunResult, scale: Scale, examTitle: string): Record<string, string> {
  return Object.fromEntries(
    reportStudents(run).map((student) => [student.student_id, studentReport(run, student, scale, examTitle)])
  )
}

/** The latest report always uses the same name in the student's home. */
export function reportFileName(): string {
  return 'informe.html'
}

/**
 * The exam's name, as its YAML says it. It is only taken from the exam that was
 * actually corrected: if the file changed after the correction, the folder's
 * name is used instead, so a report never carries the title of another exam.
 */
export async function examTitleOf(yaml: string | null, sha256: string, fallback: string): Promise<string> {
  if (yaml === null) return fallback
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(yaml))
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  if (hex !== sha256) return fallback
  const read = readExam(yaml)
  return 'exam' in read && read.exam.examen.trim() ? read.exam.examen.trim() : fallback
}

/** What the teacher is told before the reports are sent. */
export function reportsSummary(run: RunResult): string {
  const count = reportStudents(run).length
  const left = run.students.length - count
  const parts = [`${count} alumnos, cada uno con su informe`, `corrección del ${dateText(run.finished_at)}`]
  if (left > 0) parts.push(`${left} excluidos sin informe`)
  return parts.join(' · ')
}

type Tone = 'pass' | 'fail' | 'unchecked'

const TONE: Record<AcademicStatus, Tone> = {
  PASS: 'pass',
  FAIL: 'fail',
  UNEVALUATED: 'unchecked'
}

const LABEL: Record<Tone, string> = {
  pass: 'Correcta',
  fail: 'Fallada',
  unchecked: 'No se pudo comprobar'
}

const PLURAL: Record<Tone, string> = {
  pass: 'Correctas',
  fail: 'Falladas',
  unchecked: 'Sin comprobar'
}

const ICON: Record<Tone, string> = {
  pass: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="10" fill="currentColor"/><path d="M5.5 10.5l3 3 6-7" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  fail: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="10" fill="currentColor"/><path d="M6.5 6.5l7 7M13.5 6.5l-7 7" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>',
  unchecked: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.8" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2.6"/><path d="M6.5 10h7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>'
}

/** The page of one student. */
export function studentReport(
  run: RunResult,
  student: StudentResult,
  scale: Scale,
  examTitle: string,
  finalRound?: number
): string {
  const counts: Record<Tone, number> = { pass: 0, fail: 0, unchecked: 0 }
  for (const check of student.checks) counts[TONE[check.status]]++
  const total = student.checks.length
  const weights = new Set(student.checks.map((check) => check.weight))

  const groups: { name: string; checks: CheckResult[] }[] = []
  for (const check of student.checks) {
    const last = groups[groups.length - 1]
    if (last && last.name === check.group) last.checks.push(check)
    else groups.push({ name: check.group, checks: [check] })
  }

  const final = student.score.status === 'COMPLETE' ? student.score.final_score : null
  const verdict =
    final === null
      ? { tone: 'pending', text: 'Sin nota final' }
      : final >= scale.passMark
        ? { tone: 'pass', text: 'Aprobado' }
        : { tone: 'fail', text: 'Suspenso' }
  const why =
    final === null
      ? student.score.status === 'NOT_EVALUATED'
        ? 'No se pudo comprobar ninguna parte del examen. La nota se pondrá cuando se pueda revisar.'
        : 'Falta comprobar alguna parte del examen. La nota se pondrá cuando se complete.'
      : ''

  const bar = (['pass', 'fail', 'unchecked'] as Tone[])
    .filter((tone) => counts[tone] > 0)
    .map((tone) => `<span class="seg ${tone}" style="flex:${counts[tone]}"></span>`)
    .join('')
  const legend = (['pass', 'fail', 'unchecked'] as Tone[])
    .map(
      (tone) =>
        `<li class="${tone}">${ICON[tone]}<span><b>${counts[tone]}</b> ${PLURAL[tone].toLowerCase()}</span></li>`
    )
    .join('')

  // A short reading aid, drawn from the same descriptions as the full list.
  // Technical problems never enter this list, including in a partial run.
  let reviewSlots = 8
  const reviewGroups = groups
    .map((group) => {
      const failed = group.checks.filter((check) => check.status === 'FAIL').slice(0, reviewSlots)
      reviewSlots -= failed.length
      if (failed.length === 0) return ''
      return `<div class="review-group"><h3>${esc(group.name) || 'Comprobaciones'}</h3><ul>${failed
        .map((check) => `<li>${ICON.fail}<span>${esc(check.description) || '<i>Sin descripción</i>'}</span></li>`)
        .join('')}</ul></div>`
    })
    .join('')
  const remaining = counts.fail - (8 - reviewSlots)
  const review =
    counts.fail > 0
      ? `<section class="review" aria-labelledby="review-title"><h2 id="review-title">Qué debes revisar</h2><p class="review-intro">Comprobaciones no superadas en esta corrección:</p>${reviewGroups}${remaining > 0 ? `<p class="review-more">${remaining} comprobaciones falladas más en el <a href="#desglose">desglose completo</a>.</p>` : ''}</section>`
      : ''

  const sections = groups
    .map((group) => {
      const ok = group.checks.filter((check) => check.status === 'PASS').length
      const open = group.checks.filter((check) => check.status === 'UNEVALUATED').length
      const tally = `${ok} de ${group.checks.length} correctas${open ? ` · ${open} sin comprobar` : ''}`
      const rows = group.checks
        .map((check) => {
          const tone = TONE[check.status]
          const extra = [
            tone === 'unchecked' ? esc(CAUSE_TEXT[check.cause]) : '',
            weights.size > 1 ? `peso ${esc(String(check.weight).replace('.', ','))}` : ''
          ]
            .filter(Boolean)
            .join(' · ')
          return `<li class="check ${tone}">${ICON[tone]}<div class="what"><span class="${tone === 'unchecked' ? 'tag' : 'sr-only'}">${LABEL[tone]}</span><p>${esc(check.description) || '<i>Sin descripción</i>'}</p>${extra ? `<small>${extra}</small>` : ''}</div></li>`
        })
        .join('')
      return `<section class="group"><header><h2>${esc(group.name) || 'Comprobaciones'}</h2><span>${tally}</span></header><ul>${rows}</ul></section>`
    })
    .join('')

  const note =
    counts.unchecked > 0
      ? `<aside class="note">${ICON.unchecked}<p><b>«No se pudo comprobar» no es un fallo.</b> Son comprobaciones que no se pudieron hacer por un problema técnico, como una máquina que no respondía. No cuentan en contra; se pueden volver a comprobar.</p></aside>`
      : ''

  const grade = final === null ? '—' : toScale(final, scale)
  const name = esc(student.name)
  const exam = esc(examTitle)

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name} · ${exam}</title>
<style>${CSS}</style>
</head>
<body>
<main>
<header class="top">
<div class="head">
<div class="who">
<p class="exam">${exam}</p>
${finalRound ? `<p class="date">Informe final · Mejor nota de la sesión · Vuelta ${finalRound}</p>` : ''}
<h1>${name}</h1>
<p class="date">${esc(dateText(run.finished_at))}</p>
</div>
<div class="grade ${verdict.tone}">
<p class="label">${finalRound ? 'Nota final' : 'Nota'}</p>
<p class="value"><span>${grade}</span>${final === null ? '' : `<small>/ ${scale.max}</small>`}</p>
<p class="verdict">${verdict.text}</p>
</div>
</div>
${why ? `<p class="why">${why}</p>` : ''}
</header>
<section class="summary" aria-label="Resumen">
${total > 0 ? `<div class="bar" role="img" aria-label="${counts.pass} correctas, ${counts.fail} falladas y ${counts.unchecked} sin comprobar de ${total}">${bar}</div>` : '<p class="empty">No hay comprobaciones en este informe.</p>'}
<ul class="legend">${legend}</ul>
</section>
${note}
${review}
<section id="desglose" aria-label="Desglose completo">
${sections}
</section>
<footer>Informe de corrección · ${exam} · generado con Heimdall</footer>
</main>
</body>
</html>
`
}

/** Text as it goes into the page: whatever the classroom wrote is data. */
function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Light only and system fonts only: the page is printed and opened offline,
// often from a mail attachment, and must look the same everywhere.
const CSS = `
:root{--ink:#0f172a;--muted:#475569;--line:#e2e8f0;--paper:#fff;--bg:#f1f5f9;
--pass:#15803d;--fail:#b91c1c;--fail-bg:#fffafa;
--unchecked:#475569;--unchecked-bg:#f8fafc;--pending:#92400e;--pending-bg:#fffbeb;--accent:#1d4ed8}
*{box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans",Ubuntu,Cantarell,sans-serif}
main{max-width:800px;margin:32px auto;padding:40px 44px;background:var(--paper);border-radius:12px;box-shadow:0 1px 3px rgba(15,23,42,.08);overflow-wrap:anywhere}
p,h1,h2,h3{margin:0}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
a{color:var(--accent);text-underline-offset:3px}
a:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
ul{list-style:none;margin:0;padding:0}
svg{width:20px;height:20px;flex:none}
.top{border-bottom:1px solid var(--line);padding-bottom:18px}
::selection{background:#bfdbfe;color:var(--ink)}
.head{display:flex;gap:24px;align-items:center;justify-content:space-between}
.who{min-width:0;flex:1}
.exam{font-size:15px;color:var(--accent);font-weight:600}
h1{font-size:30px;line-height:1.15;font-weight:700;letter-spacing:-.01em;margin-top:4px;overflow-wrap:anywhere}
.date{font-size:14px;color:var(--muted);margin-top:6px}
.grade{flex:none;max-width:100%;text-align:right;padding:4px 0 4px 20px;border-left:1px solid var(--line)}
.grade.pass{color:var(--pass)}
.grade.fail{color:var(--fail)}
.grade.pending{color:var(--pending)}
.grade .label{font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}
.grade .value{line-height:1;margin:4px 0 6px;font-variant-numeric:tabular-nums}
.grade .value span{font-size:52px;font-weight:600;letter-spacing:-.02em}
.grade .value small{font-size:18px;font-weight:400;margin-left:4px;color:var(--muted)}
.grade .verdict{font-size:14px;font-weight:500}
.why{margin-top:16px;font-size:14px;color:var(--pending);background:var(--pending-bg);border-radius:8px;padding:10px 14px}
.summary{padding:18px 0 4px}
.bar{display:flex;gap:0;height:8px;border-radius:999px;overflow:hidden;background:var(--line)}
.seg.pass{background:var(--pass)}
.seg.fail{background:var(--fail)}
.seg.unchecked{background:repeating-linear-gradient(135deg,#94a3b8 0 4px,#cbd5e1 4px 8px)}
.legend{display:flex;flex-wrap:wrap;gap:8px 24px;margin-top:10px;font-size:14px;color:var(--muted)}
.legend li{display:flex;align-items:center;gap:8px}
.legend b{color:var(--ink);font-variant-numeric:tabular-nums}
.legend .pass svg{color:var(--pass)}
.legend .fail svg{color:var(--fail)}
.legend .unchecked svg{color:var(--unchecked)}
.note{display:flex;gap:10px;align-items:flex-start;margin-top:16px;padding:10px 12px;border:1px dashed #94a3b8;border-radius:8px;background:var(--unchecked-bg);font-size:14px;color:var(--muted)}
.note svg{color:var(--unchecked);margin-top:2px}
.note b{color:var(--ink)}
.review{margin-top:22px;padding:14px 16px;background:var(--fail-bg);border:1px solid var(--line);border-radius:8px}
.review h2{font-size:19px;font-weight:600;break-after:avoid}
.review-intro,.review-more{font-size:14px;color:var(--muted)}
.review-intro{margin-top:2px;break-after:avoid}
.review-group{margin-top:12px}
.review h3{font-size:14px;font-weight:600;break-after:avoid}
.review li{display:flex;align-items:flex-start;gap:8px;margin-top:5px;font-size:14px;break-inside:avoid}
.review svg{width:16px;height:16px;color:var(--fail);margin-top:3px}
.review-more{margin-top:12px}
.group{margin-top:22px}
.group header{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:2px 16px;padding-bottom:7px;border-bottom:1px solid var(--line);break-after:avoid}
.group h2{font-size:18px;font-weight:600;min-width:0}
.group header span{font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums}
.group>ul{break-before:avoid}
.check{display:flex;gap:10px;align-items:flex-start;padding:9px 8px;border-bottom:1px solid var(--line);break-inside:avoid}
.check:first-child{break-before:avoid}
.check svg{width:18px;height:18px;margin-top:3px}
.check .what{flex:1;min-width:0}
.check small{display:block;font-size:13px;color:var(--muted);margin-top:2px}
.tag{display:block;font-size:13px;font-weight:600;color:var(--unchecked);margin-bottom:2px}
.check.pass svg{color:var(--pass)}
.check.fail{background:var(--fail-bg)}
.check.fail svg{color:var(--fail)}
.check.unchecked svg{color:var(--unchecked)}
.check.unchecked p{color:var(--muted)}
footer{margin-top:26px;font-size:12px;color:var(--muted);text-align:center}
@media (max-width:600px){main{margin:0;border-radius:0;padding:24px 16px}.head{gap:14px;flex-wrap:wrap;align-items:flex-start}.who{flex-basis:210px}.grade{padding-left:14px}h1{font-size:26px}.grade .value span{font-size:44px}.review{padding:12px}.legend{gap:6px 16px}}
@page{size:A4;margin:14mm}
@media print{
body{background:#fff;font-size:11pt;orphans:2;widows:2}
main{margin:0;max-width:none;padding:0;box-shadow:none;border-radius:0}
.top,.summary,.note{break-inside:avoid}
.group{break-inside:auto}
.check{display:block;position:relative;padding-left:28px;break-inside:auto;orphans:3;widows:3}
.check>svg{position:absolute;left:0;top:9px}
.tag{break-after:avoid}
.check small{break-before:avoid}
.review{background:none}
.review li{display:block;position:relative;padding-left:24px;break-inside:auto;orphans:3;widows:3}
.review li svg{position:absolute;left:0;top:0}
footer{font-size:9pt}
}
`
