import { execFile } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { aulaFileName, aulaYaml } from '../shared/aula'
import type { ClassGroup } from '../shared/classes'
import type { ExamCheck } from '../shared/types'

/** The exam file the engine looks for. Same name as anywhere else. */
const EXAM_FILE = 'examen.yaml'

/** Long enough for a real exam, short enough that a hung engine is noticed. */
const TIMEOUT_MS = 20_000

/**
 * Asks the engine whether this exam is valid, before it is saved (T109).
 *
 * It is the engine that answers and not a second validator in the interface:
 * two validators drift, and the one that decides is the one that corrects.
 * `heimdall check` touches no machine — it resolves the PLAN and stops.
 *
 * The exam is written to a folder of its own, so the teacher's file is never
 * touched by a check that failed. The classroom is the one this class would
 * really produce, because half the errors of an exam are about the class:
 * `${alumno.subdominio}` is only valid if that column exists.
 */
export async function validateExam(
  enginePath: string,
  yaml: string,
  group: ClassGroup,
  shownAs: string
): Promise<ExamCheck> {
  const dir = mkdtempSync(join(tmpdir(), 'heimdall-check-'))
  try {
    writeFileSync(join(dir, EXAM_FILE), yaml, 'utf-8')
    const cname = aulaFileName(group)
    writeFileSync(join(dir, cname), aulaYaml(group), 'utf-8')
    const { code, stdout, stderr } = await run(enginePath, ['check', `--cname=${cname}`, dir])
    // The engine names the file it read, which is the temporary copy. What
    // the teacher has open is the project's exam, and the line number is the
    // same one: only the name in front of it changes.
    const message = clean(`${stderr}${stdout}`, dir, shownAs)
    return code === 0 ? { ok: true, message } : { ok: false, message }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function run(
  path: string,
  args: string[]
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(path, args, { timeout: TIMEOUT_MS }, (error, stdout, stderr) => {
      const code = (error as { code?: number } | null)?.code
      // An exit code is an answer, not a failure: 2 is «not valid» and it is
      // exactly what was asked. Anything without one —the binary is not
      // there, it hung— is a real failure and is reported as such.
      if (error && typeof code !== 'number') {
        reject(new Error(`No se pudo comprobar el examen con el motor: ${error.message}`))
        return
      }
      resolve({ code: code ?? 0, stdout, stderr })
    })
  })
}

/** The temporary folder's name swapped for the one the teacher knows. */
function clean(message: string, dir: string, shownAs: string): string {
  return message.split(dir).join(shownAs).trim()
}
