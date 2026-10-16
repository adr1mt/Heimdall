import type { StudentResult } from '../../../shared/artifact'

/** Presentation only: an unfinished grade can never look like a pass or fail. */
export function gradeAppearance(student: StudentResult, passMark: number) {
  if (student.status === 'EXCLUDED')
    return { label: 'Excluido', tone: 'neutral' as const, color: 'text-muted-foreground' }
  if (
    student.checks.some((check) => check.status === 'UNEVALUATED') ||
    student.score.status !== 'COMPLETE' ||
    student.score.final_score === null
  ) {
    return {
      label: student.score.status === 'NOT_EVALUATED' ? 'Sin evaluar' : 'Incompleto',
      tone: 'warning' as const,
      color: 'text-warning-strong'
    }
  }
  return student.score.final_score >= passMark
    ? { label: 'Aprobado', tone: 'pass' as const, color: 'text-success-strong' }
    : { label: 'Suspenso', tone: 'fail' as const, color: 'text-destructive-strong' }
}
