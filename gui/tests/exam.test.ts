import { describe, expect, it } from 'vitest'
import {
  EXAM_OFF,
  examStarted,
  examStopped,
  passFinished,
  passStarted,
  secondsLeft,
  shouldStartPass
} from '../src/renderer/src/lib/exam'
import type { RunPhase } from '../src/renderer/src/lib/run-state'

const NOW = 1_700_000_000_000
const PHASES: RunPhase[] = ['idle', 'starting', 'running', 'finished']

describe('modo examen', () => {
  it('empieza apagado y sin nada pendiente', () => {
    expect(EXAM_OFF.active).toBe(false)
    expect(EXAM_OFF.nextAt).toBeNull()
    expect(shouldStartPass(EXAM_OFF, 'idle', NOW)).toBe(false)
  })

  it('la primera vuelta sale en cuanto se enciende', () => {
    const exam = examStarted(10, NOW)
    expect(shouldStartPass(exam, 'idle', NOW)).toBe(true)
  })

  // El criterio que importa: nunca dos motores a la vez.
  it('no lanza una vuelta con el motor trabajando, en ninguna fase', () => {
    const exam = examStarted(10, NOW)
    for (const phase of PHASES) {
      const busy = phase === 'starting' || phase === 'running'
      expect(shouldStartPass(exam, phase, NOW + 60_000)).toBe(!busy)
    }
  })

  it('una vuelta lanzada no deja nada pendiente hasta que termina', () => {
    const started = passStarted(examStarted(10, NOW))
    expect(started.passes).toBe(1)
    expect(started.nextAt).toBeNull()
    // Aunque pase una hora y el motor ya no esté, nada vence.
    expect(shouldStartPass(started, 'finished', NOW + 3_600_000)).toBe(false)
  })

  it('el intervalo se cuenta desde el final de la vuelta', () => {
    const started = passStarted(examStarted(10, NOW))
    const done = passFinished(started, NOW + 5 * 60_000)
    expect(done.nextAt).toBe(NOW + 15 * 60_000)
    expect(shouldStartPass(done, 'finished', NOW + 14 * 60_000)).toBe(false)
    expect(shouldStartPass(done, 'finished', NOW + 15 * 60_000)).toBe(true)
  })

  it('apagado, el final de una vuelta no programa nada', () => {
    const stopped = examStopped(passStarted(examStarted(10, NOW)))
    expect(passFinished(stopped, NOW).nextAt).toBeNull()
    expect(shouldStartPass(passFinished(stopped, NOW), 'finished', NOW + 3_600_000)).toBe(false)
  })

  it('apagarlo cancela lo pendiente', () => {
    const exam = passFinished(passStarted(examStarted(5, NOW)), NOW)
    expect(shouldStartPass(examStopped(exam), 'idle', NOW + 3_600_000)).toBe(false)
  })

  it('cuenta atrás: segundos que faltan, nunca negativos', () => {
    const exam = passFinished(passStarted(examStarted(10, NOW)), NOW)
    expect(secondsLeft(exam, NOW)).toBe(600)
    expect(secondsLeft(exam, NOW + 601_000)).toBe(0)
    expect(secondsLeft(passStarted(exam), NOW)).toBeNull()
    expect(secondsLeft(EXAM_OFF, NOW)).toBeNull()
  })
})
