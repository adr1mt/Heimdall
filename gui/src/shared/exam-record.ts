import type { Session } from './session'

export interface ExamRecord {
  version: 1
  id: string
  examPath: string
  classId: string
  className: string
  roster: { id: string; name: string; moodleId: string }[]
  title: string
  createdAt: string
  state: 'ACTIVE' | 'FINALIZING' | 'FINALIZED'
  closedAt?: string
  passMark: number
  examHash: string
  inventoryHash: string
  inventoryName: string
  planHash?: string
  rounds: { path: string; runId: string; sha256: string }[]
  pending?: { before: string[] }
  finalOrigins?: { studentId: string; runId?: string }[]
  reportScale?: { id: 'ten' | 'hundred'; passMark: number }
  delivery: Record<string, { state: 'SENDING' | 'SENT' | 'FAILED'; at: string; reason?: string }>
}

export interface SavedExam {
  record: ExamRecord
  session: Session | null
}
