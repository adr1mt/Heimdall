/**
 * Launching a correction, from the button and from the exam-mode timer.
 *
 * Both go through here so that the guard against launching one on top of
 * another is written once. The main process refuses a second engine anyway;
 * this one keeps the interface from even asking.
 */

import { useApp, noticeFrom } from '@/stores/app'
import { useRun } from '@/stores/run'

/** Whether an engine is already working for us. */
export function busy(): boolean {
  const phase = useRun.getState().phase
  return phase === 'starting' || phase === 'running'
}

/**
 * Starts a correction of the whole class. `secrets` is empty on the passes
 * exam mode chains: the credentials are held by the main process for as long
 * as the mode lasts and never come back to the interface.
 */
export async function startCorrection(secrets: Record<string, string>): Promise<boolean> {
  const { examPath, classPath, retry, exam, examRounds } = useApp.getState()
  if (!examPath || !classPath || busy()) return false

  useRun.getState().begin()
  try {
    // The retry travels as the path of the previous artifact and nothing
    // else: the engine decides what gets repeated (ADR-0018).
    // During an exam the earlier rounds travel with the run: the engine reads
    // them and leaves out whoever already finished. A retry is the other rule
    // and never goes with them (ADR-0020).
    const sessionRounds = exam.active ? examRounds : []
    await window.heimdall.startRun({
      examPath,
      classPath,
      secrets,
      retryFrom: sessionRounds.length > 0 ? undefined : retry?.artifactPath,
      sessionRounds
    })
    return true
  } catch (error) {
    useRun.getState().fail(noticeFrom('No se pudo empezar la corrección', error))
    return false
  } finally {
    useApp.getState().setRetry(null)
  }
}
