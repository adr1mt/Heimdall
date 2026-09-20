// The native contract, as the GUI reads it (docs/design/09-CONTRATO-GUI.md).
//
// Field names are English because this is a machine contract, and they are the
// engine's own. Nothing here is a source of truth: the artifact is. An event
// that gets lost costs progress on screen and never a grade.

/** The contract version this build knows how to read. */
export const CONTRACT_VERSION = 1

export type AcademicStatus = 'PASS' | 'FAIL' | 'UNEVALUATED'
export type StudentStatus = 'OK' | 'PARTIAL' | 'NOT_EVALUATED' | 'EXCLUDED'
export type RunStatus = 'COMPLETE' | 'PARTIAL' | 'CANCELLED' | 'INVALID_CONFIG'
export type ScoreStatus = 'COMPLETE' | 'INCOMPLETE' | 'NOT_EVALUATED' | 'EXCLUDED'

/** The five numbers and the status. Read `status` before either score. */
export interface Score {
  obtained: number
  evaluable: number
  total: number
  unevaluated: number
  provisional_score: number | null
  final_score: number | null
  status: ScoreStatus
}

export interface PlanSummary {
  check_count: number
  total_weight: number
  check_ids: string[]
  concurrency: number
  host_concurrency: number
}

export interface StudentRef {
  student_id: string
  name: string
  moodle_id?: string
  excluded: boolean
}

export interface Warning {
  scope: string
  code: string
  message: string
}

interface Envelope {
  seq: number
  ts: string
}

export interface RunStartEvent extends Envelope {
  event: 'run.start'
  contract_version: number
  run_id: string
  engine_version: string
  plan: PlanSummary
  expected_checks: number
  students: StudentRef[]
  /** Set when this run repeats what an earlier one left unevaluated. */
  retry_of?: { run_id: string; artifact: string; run_at: string; students: number; checks: number }
}

export interface StudentStartEvent extends Envelope {
  event: 'student.start'
  student_id: string
  name: string
}

export interface CheckEndEvent extends Envelope {
  event: 'check.end'
  student_id: string
  check_id: string
  group?: string
  weight: number
  status: AcademicStatus
  cause: string
  detail?: string
  duration_ms: number | null
}

export interface StudentEndEvent extends Envelope {
  event: 'student.end'
  student_id: string
  status: StudentStatus
  score: Score
}

export interface RunEndEvent extends Envelope {
  event: 'run.end'
  status: RunStatus
  exit_code: number
  artifact: string
  counts: { students: number; pass: number; fail: number; unevaluated: number }
  warnings?: Warning[]
}

export type EngineEvent =
  | RunStartEvent
  | StudentStartEvent
  | CheckEndEvent
  | StudentEndEvent
  | RunEndEvent

const KNOWN = ['run.start', 'student.start', 'check.end', 'student.end', 'run.end']

/**
 * Parses one line of the stream. An unknown event name, a malformed line or
 * anything that is not an object is ignored, on purpose: the contract says a
 * consumer must ignore what it does not know instead of failing (§5). The
 * engine may also write a line we do not know yet, and that is not a reason to
 * abandon a correction that is running.
 */
export function parseEvent(line: string): EngineEvent | null {
  const text = line.trim()
  if (!text) return null
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof value !== 'object' || value === null) return null
  const candidate = value as { event?: unknown; seq?: unknown }
  if (typeof candidate.event !== 'string' || !KNOWN.includes(candidate.event)) return null
  if (typeof candidate.seq !== 'number') return null
  return value as EngineEvent
}
