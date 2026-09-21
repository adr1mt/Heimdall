// The canonical artifact, as the GUI reads it. It is the source of truth: the
// event stream only says what is happening, and everything the teacher is
// shown on the results screen comes from here (ADR-0007,
// docs/design/04-MODELO-RESULTADO.md).

import type {
  AcademicStatus,
  PlanSummary,
  RunStatus,
  Score,
  StudentStatus,
  Warning
} from './events'

/** The schema version this build knows how to read. */
export const SCHEMA_VERSION = 1

export type Cause =
  | 'NONE'
  | 'CONNECT_FAILED'
  | 'AUTH_FAILED'
  | 'TIMEOUT'
  | 'CONNECTION_LOST'
  | 'NOT_RUN'
  | 'CANCELLED'
  | 'OUTPUT_OVERFLOW'
  | 'ENGINE_ERROR'

export type RemoteProcess = 'FINISHED' | 'KILLED_REMOTE' | 'UNKNOWN'

export interface SourceRef {
  path: string
  sha256: string
  version?: string
}

/** One captured stream. The student's output is untrusted data, and capped. */
export interface Stream {
  text: string
  bytes: number
  bytes_total: number
  truncated: boolean
}

/** The facts about the process. It knows nothing about grades. */
export interface ExecutionResult {
  host: string
  address: string
  user: string
  transport: string
  command: string[]
  started_at: string
  duration_ms: number
  completed: boolean
  exit_code: number | null
  overflow: boolean
  stdout: Stream
  stderr: Stream
  connect_attempts: number
  command_attempts: number
  remote_process: RemoteProcess
}

/** What was compared and what was found. No grade. */
export interface AssertionResult {
  kind: string
  expected: string
  found: string
  matched: boolean
  where?: string
}

/**
 * What this same check was in the run that this one repeated. It is a record,
 * not a result: no grade is computed from it, and the run it names still holds
 * its own artifact with the full evidence (ADR-0018).
 */
export interface PreviousAttempt {
  run_id: string
  status: AcademicStatus
  cause: Cause
  detail?: string
  finished_at: string
}

/** The run this one repeated, and how much of it. */
export interface RetryRef {
  run_id: string
  artifact: string
  run_at: string
  students: number
  checks: number
}

export interface CheckResult {
  check_id: string
  group: string
  description: string
  weight: number
  status: AcademicStatus
  cause: Cause
  detail?: string
  execution: ExecutionResult | null
  assertion: AssertionResult | null
  previous?: PreviousAttempt
}

export interface StudentResult {
  student_id: string
  name: string
  moodle_id?: string
  status: StudentStatus
  started_at: string
  finished_at: string
  score: Score
  checks: CheckResult[]
}

export interface RunResult {
  schema_version: number
  run_id: string
  engine_version: string
  started_at: string
  finished_at: string
  status: RunStatus
  exam: SourceRef
  inventory: SourceRef
  plan_hash: string
  plan: PlanSummary
  students: StudentResult[]
  warnings?: Warning[]
  /** Set when this run repeated what an earlier one left unevaluated. */
  retry_of?: RetryRef
}

/**
 * Reads an artifact. It refuses a schema it does not know instead of guessing:
 * a field that changed meaning would be read as a grade that is not there.
 * Anything beyond the fields this build knows is left alone, which is what
 * lets a newer engine add one without breaking this screen.
 */
export function parseArtifact(text: string): RunResult {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('El fichero de resultados no es un JSON válido.')
  }
  if (typeof value !== 'object' || value === null) {
    throw new Error('El fichero de resultados no tiene la forma de un resultado.')
  }
  const run = value as Partial<RunResult>
  if (run.schema_version !== SCHEMA_VERSION) {
    throw new Error(
      `El resultado está escrito en la versión ${String(run.schema_version)} del formato y la aplicación entiende la ${SCHEMA_VERSION}.`
    )
  }
  if (!Array.isArray(run.students) || !run.plan) {
    throw new Error('El fichero de resultados está incompleto.')
  }
  // A student nobody evaluated carries no checks, and that is written as
  // nothing at all. It is read as «ninguna comprobación», which is what it
  // means: an excluded student is the ordinary case since a round of an exam
  // session leaves out whoever already finished (T063).
  for (const student of run.students) {
    if (!Array.isArray(student.checks)) student.checks = []
  }
  return run as RunResult
}
