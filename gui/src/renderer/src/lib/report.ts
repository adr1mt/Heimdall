import type { CheckResult, RunResult, StudentResult } from '../../../shared/artifact'
import type { AcademicStatus } from '../../../shared/events'
import { readExam } from '../../../shared/exam'
import { CAUSE_TEXT, dateText } from './results'
import { toScale, type Scale } from './scale'

/**
 * One page per student, to hand back through Moodle or by mail (T185).
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

/** One report, ready to be written as a file. */
export interface ReportFile {
  name: string
  html: string
}

/** The students that get a report: whoever took part in this correction. */
export function reportStudents(run: RunResult): StudentResult[] {
  return run.students.filter((student) => student.status !== 'EXCLUDED')
}

/** Every report of a run, with a file name no other report shares. */
export function reportFiles(run: RunResult, scale: Scale, examTitle: string): ReportFile[] {
  const used = new Set<string>()
  return reportStudents(run).map((student) => {
    const base = slug(student.name) || 'alumno'
    let name = `${base}.html`
    if (used.has(name)) name = `${base}-${slug(student.student_id) || 'x'}.html`
    for (let n = 2; used.has(name); n++) name = `${base}-${n}.html`
    used.add(name)
    return { name, html: studentReport(run, student, scale, examTitle) }
  })
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

/** What the folder is called, so two rounds of reports never mix. */
export function reportsFolderName(run: RunResult, examTitle: string): string {
  const stamp = run.started_at.replace(/[-:]/g, '').replace(/[.Z].*$/, '').replace('T', '-')
  return `informes-${slug(examTitle) || 'examen'}-${stamp}`
}

/** What the teacher is told before the reports are written. */
export function reportsSummary(run: RunResult): string {
  const count = reportStudents(run).length
  const left = run.students.length - count
  const parts = [`${count} informes, uno por alumno`, `corrección del ${dateText(run.finished_at)}`]
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
  examTitle: string
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
          return `<li class="check ${tone}">${ICON[tone]}<div class="what"><p>${esc(check.description) || '<i>Sin descripción</i>'}</p>${extra ? `<small>${extra}</small>` : ''}</div><span class="tag">${LABEL[tone]}</span></li>`
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
<h1>${name}</h1>
<p class="date">${esc(dateText(run.finished_at))}</p>
</div>
<div class="grade ${verdict.tone}">
<p class="label">Nota</p>
<p class="value"><span>${grade}</span>${final === null ? '' : `<small>/ ${scale.max}</small>`}</p>
<p class="verdict">${verdict.text}</p>
</div>
</div>
${why ? `<p class="why">${why}</p>` : ''}
</header>
<section class="summary" aria-label="Resumen">
<div class="bar" role="img" aria-label="${counts.pass} correctas, ${counts.fail} falladas y ${counts.unchecked} sin comprobar de ${total}">${bar}</div>
<ul class="legend">${legend}</ul>
</section>
${note}
${sections}
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

/** A name as it goes into a file name, readable and safe in any system. */
function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

// Light only and system fonts only: the page is printed and opened offline,
// often from a mail attachment, and must look the same everywhere.
const CSS = `
:root{--ink:#0f172a;--muted:#475569;--line:#e2e8f0;--paper:#fff;--bg:#f1f5f9;
--pass:#15803d;--pass-bg:#f0fdf4;--fail:#b91c1c;--fail-bg:#fef2f2;
--unchecked:#475569;--unchecked-bg:#f8fafc;--pending:#92400e;--pending-bg:#fffbeb;--accent:#1d4ed8}
*{box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans",Ubuntu,Cantarell,sans-serif}
main{max-width:800px;margin:32px auto;padding:40px 44px;background:var(--paper);border-radius:12px;box-shadow:0 1px 3px rgba(15,23,42,.08)}
p,h1,h2{margin:0}
ul{list-style:none;margin:0;padding:0}
svg{width:20px;height:20px;flex:none}
.top{border-bottom:1px solid var(--line);padding-bottom:24px}
::selection{background:#bfdbfe;color:var(--ink)}
.head{display:flex;gap:24px;align-items:center;justify-content:space-between}
.who{min-width:0}
.exam{font-size:15px;color:var(--accent);font-weight:600}
h1{font-size:34px;line-height:1.15;font-weight:700;letter-spacing:-.01em;margin-top:4px;overflow-wrap:anywhere}
.date{font-size:14px;color:var(--muted);margin-top:6px}
.grade{flex:none;min-width:168px;text-align:center;padding:14px 20px 12px;border-radius:12px;border:2px solid currentColor}
.grade.pass{color:var(--pass);background:var(--pass-bg)}
.grade.fail{color:var(--fail);background:var(--fail-bg)}
.grade.pending{color:var(--pending);background:var(--pending-bg)}
.grade .label{font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}
.grade .value{line-height:1;margin:4px 0 6px;font-variant-numeric:tabular-nums}
.grade .value span{font-size:60px;font-weight:800;letter-spacing:-.02em}
.grade .value small{font-size:20px;font-weight:600;margin-left:4px}
.grade .verdict{font-size:15px;font-weight:700}
.why{margin-top:16px;font-size:14px;color:var(--pending);background:var(--pending-bg);border-radius:8px;padding:10px 14px}
.summary{padding:22px 0 6px}
.bar{display:flex;gap:3px;height:12px;border-radius:999px;overflow:hidden;background:var(--line)}
.seg.pass{background:var(--pass)}
.seg.fail{background:var(--fail)}
.seg.unchecked{background:repeating-linear-gradient(135deg,#94a3b8 0 4px,#cbd5e1 4px 8px)}
.legend{display:flex;flex-wrap:wrap;gap:8px 24px;margin-top:12px;font-size:14px;color:var(--muted)}
.legend li{display:flex;align-items:center;gap:8px}
.legend b{color:var(--ink);font-variant-numeric:tabular-nums}
.legend .pass svg{color:var(--pass)}
.legend .fail svg{color:var(--fail)}
.legend .unchecked svg{color:var(--unchecked)}
.note{display:flex;gap:12px;align-items:flex-start;margin-top:18px;padding:12px 16px;border:1.5px dashed #94a3b8;border-radius:10px;background:var(--unchecked-bg);font-size:14px;color:var(--muted)}
.note svg{color:var(--unchecked);margin-top:2px}
.note b{color:var(--ink)}
.group{margin-top:26px;break-inside:avoid-page}
.group header{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding-bottom:8px;border-bottom:2px solid var(--ink)}
.group h2{font-size:18px;font-weight:700}
.group header span{font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}
.check{display:flex;gap:12px;align-items:flex-start;padding:11px 0;border-bottom:1px solid var(--line);break-inside:avoid}
.check svg{margin-top:2px}
.check .what{flex:1;min-width:0}
.check p{overflow-wrap:anywhere}
.check small{display:block;font-size:13px;color:var(--muted);margin-top:2px}
.tag{flex:none;font-size:13px;font-weight:600;padding:2px 10px;border-radius:999px;white-space:nowrap}
.check.pass svg{color:var(--pass)}
.check.pass .tag{color:var(--pass);background:var(--pass-bg)}
.check.fail svg{color:var(--fail)}
.check.fail .tag{color:var(--fail);background:var(--fail-bg)}
.check.unchecked svg{color:var(--unchecked)}
.check.unchecked p{color:var(--muted)}
.check.unchecked .tag{color:var(--unchecked);background:var(--unchecked-bg);border:1px dashed #94a3b8}
footer{margin-top:32px;font-size:12px;color:var(--muted);text-align:center}
@media (max-width:600px){main{margin:0;border-radius:0;padding:24px 16px}.head{flex-direction:column;align-items:stretch}h1{font-size:28px}}
@page{size:A4;margin:14mm}
@media print{body{background:#fff}main{margin:0;max-width:none;padding:0;box-shadow:none;border-radius:0}}
`
