import type { StudentResult } from '../../../shared/artifact'

/**
 * Presentation only: an unfinished grade can never look like a pass or fail.
 * `color` tints text; `fill` paints the grade badge the teacher reads first.
 */
export function gradeAppearance(student: StudentResult, passMark: number) {
  if (student.status === 'EXCLUDED')
    return {
      label: 'Excluido',
      tone: 'neutral' as const,
      color: 'text-muted-foreground',
      fill: 'bg-muted text-muted-foreground'
    }
  if (
    student.checks.some((check) => check.status === 'UNEVALUATED') ||
    student.score.status !== 'COMPLETE' ||
    student.score.final_score === null
  ) {
    return {
      label: student.score.status === 'NOT_EVALUATED' ? 'Sin evaluar' : 'Incompleto',
      tone: 'warning' as const,
      color: 'text-warning-strong',
      fill: 'bg-warning/15 text-warning-strong ring-1 ring-inset ring-warning/40'
    }
  }
  return student.score.final_score >= passMark
    ? {
        label: 'Aprobado',
        tone: 'pass' as const,
        color: 'text-success-strong',
        fill: 'bg-success text-success-foreground'
      }
    : {
        label: 'Suspenso',
        tone: 'fail' as const,
        color: 'text-destructive-strong',
        fill: 'bg-destructive text-destructive-foreground'
      }
}
