// The safety copy of a correction: the grades, and nothing else.
//
// A backup is not a second artifact. It carries what a grade is made of —the
// score of each student and the status and weight of each check— and leaves
// behind everything the machines said. Two reasons, and both are hard rules
// here: the output of a student's machine is untrusted data that has no place
// in a copy nobody will ever audit (`.claude/rules/security.md`), and a copy
// of the evidence is not what gets lost when a folder is deleted.

import type { RunResult } from './artifact'

/** Said in the restored file itself, so nobody mistakes it for the original. */
export const FROM_BACKUP = {
  scope: 'run',
  code: 'RESTORED_FROM_BACKUP',
  message:
    'Estas notas vienen de una copia de seguridad. Conservan la nota de cada alumno, ' +
    'pero no la salida de las máquinas: el detalle de cada comprobación no está.'
} as const

/**
 * The grades of a run, ready to be written as a copy. The result is still a
 * valid artifact —`execution` and `assertion` are nullable— so the restored
 * file opens on the results screen like any other.
 */
export function gradesOnly(run: RunResult): RunResult {
  return {
    ...run,
    students: run.students.map((student) => ({
      ...student,
      checks: student.checks.map((check) => ({
        ...check,
        execution: null,
        assertion: null
      }))
    })),
    warnings: [...(run.warnings ?? []), { ...FROM_BACKUP }]
  }
}

/** One copy on disk, as the history screen lists it. */
export interface BackupEntry {
  /** The copy itself. */
  path: string
  /** The run it holds, so a copy is recognised by its correction. */
  runId: string
  at: string
  students: number
  /** Whether the run this copy stands for is still in the exam's folder. */
  onDisk: boolean
}

/** What a restore did. Nothing is ever overwritten, so both numbers matter. */
export interface RestoreReport {
  /** Copies written back into the exam's folder. */
  restored: number
  /** Copies left alone because the correction was already there. */
  kept: number
}
