import { describe, expect, it } from 'vitest'
import { gradeAppearance } from '@/lib/grade-appearance'
import { attentionStudents, gradeHistogram } from '@/lib/analytics'
import type { RunResult, StudentResult } from '../src/shared/artifact'

function student(
  id: string,
  value: number | null,
  status: 'COMPLETE' | 'INCOMPLETE' | 'NOT_EVALUATED' | 'EXCLUDED' = 'COMPLETE',
  technical = false
): StudentResult {
  return {
    student_id: id,
    name: id,
    status: status === 'COMPLETE' ? 'OK' : status === 'INCOMPLETE' ? 'PARTIAL' : status,
    score: { status, final_score: status === 'COMPLETE' ? value : null, provisional_score: value },
    checks: [
      { status: technical ? 'UNEVALUATED' : 'PASS', cause: technical ? 'CONNECT_FAILED' : 'NONE' }
    ]
  } as StudentResult
}

describe('grade presentation', () => {
  it('uses the configured boundary, including a real zero', () => {
    expect(gradeAppearance(student('zero', 0), 70).tone).toBe('fail')
    expect(gradeAppearance(student('below', 69), 70).tone).toBe('fail')
    expect(gradeAppearance(student('equal', 70), 70).tone).toBe('pass')
    expect(gradeAppearance(student('custom', 60), 50).tone).toBe('pass')
  })
  it('never paints provisional success green or technical failure red', () => {
    expect(gradeAppearance(student('partial', 100, 'INCOMPLETE', true), 70).tone).toBe('warning')
    expect(gradeAppearance(student('offline', null, 'NOT_EVALUATED', true), 70)).toMatchObject({
      label: 'Sin evaluar',
      tone: 'warning'
    })
    expect(gradeAppearance(student('missing', null), 70).tone).toBe('warning')
    expect(gradeAppearance(student('diagnostic', 100, 'COMPLETE', true), 70).tone).toBe('warning')
    expect(gradeAppearance(student('excluded', null, 'EXCLUDED'), 70).tone).toBe('neutral')
  })
})

describe('analytics presentation', () => {
  const run = {
    students: [
      student('zero', 0),
      student('threshold', 70),
      student('perfect', 100),
      student('partial', 100, 'INCOMPLETE', true),
      student('offline', null, 'NOT_EVALUATED', true),
      student('excluded', null, 'EXCLUDED')
    ]
  } as RunResult
  it('counts final grades once, includes 100, and excludes incomplete grades', () => {
    const { bins, ungraded } = gradeHistogram(run, 70)
    expect(bins[0]).toMatchObject({ failed: 1, passed: 0 })
    expect(bins[7].passed).toBe(1)
    expect(bins[9].passed).toBe(1)
    expect(bins.reduce((sum, bin) => sum + bin.failed + bin.passed, 0)).toBe(3)
    expect(ungraded).toBe(2)
  })
  it('supports a threshold inside a bin without miscolouring its students', () => {
    const { bins } = gradeHistogram(
      { students: [student('below', 73), student('above', 77)] } as RunResult,
      75
    )
    expect(bins[7]).toMatchObject({ failed: 1, passed: 1 })
  })
  it('places technical incidents ahead of academic failures and excludes passes', () => {
    expect(attentionStudents(run, 70).map((s) => s.student_id)).toEqual([
      'partial',
      'offline',
      'zero'
    ])
  })
})
