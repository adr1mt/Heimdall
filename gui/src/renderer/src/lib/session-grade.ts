import type { StudentResult } from '../../../shared/artifact'
import type { SavedExam } from '../../../shared/exam-record'

/** A session grade changes presentation only; latest checks remain untouched. */
export function sessionGrade(student: StudentResult, saved: SavedExam | null): { student: StudentResult; label: string; origin: string } {
  const best = saved?.session?.students.find(s => s.student_id === student.student_id)
  if (!best) {
    if (saved) return {
      student: { ...student, status: 'NOT_EVALUATED', score: { ...student.score, obtained: 0, evaluable: 0, unevaluated: student.score.total, final_score: null, provisional_score: null, status: 'NOT_EVALUATED' } },
      label: 'Sin nota final', origin: 'Ninguna vuelta con evaluación completa de los criterios actuales.'
    }
    return { student, label: '', origin: '' }
  }
  const label = saved?.record.state === 'FINALIZED' ? 'Nota final' : 'Mejor nota'
  return {
    student: { ...student, score: best.score, status: best.status === 'EXCLUDED' ? 'EXCLUDED' : best.from_round ? 'OK' : 'NOT_EVALUATED' },
    label: best.from_round ? label : 'Sin nota final',
    origin: best.from_round ? `Vuelta ${best.from_round}` : best.reason || 'Ninguna vuelta con evaluación completa.'
  }
}
