import { useExamRecord } from '@/stores/exam-record'
import { useRun } from '@/stores/run'
import type { StudentResult } from '../../../shared/artifact'
import { sessionGrade } from './session-grade'

export function useBoundExam() {
  const saved = useExamRecord(s => s.saved)
  const artifact = useRun(s => s.artifact)
  if (saved && saved.record.rounds.length === 0 && saved.record.examPath === artifact?.exam.path) return saved
  return saved?.record.rounds.at(-1)?.runId === artifact?.run_id && saved?.session?.plan_hash === artifact?.plan_hash ? saved : null
}

export function useSessionGrade(student: StudentResult) {
  return sessionGrade(student, useBoundExam())
}
