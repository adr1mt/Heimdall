import { spawn } from 'node:child_process'
import { secretsLine } from './run'
import type { Delivery } from '../shared/types'

/**
 * Asking the engine to leave each student's report on their own machine
 * (ADR-0031). This process never opens SSH: it hands the pages and the class
 * password to `heimdall deliver` through stdin, and reads back to whom the
 * report arrived and why not.
 */

/** The engine bounds every student; this only guards against a stuck engine. */
const TIMEOUT_MS = 5 * 60_000

/** The answer is one short line per student; past this the engine is broken. */
const MAX_OUTPUT = 4 << 20

const OK = 0
const PARTIAL = 3

/** The argument vector: no password and no report in it, ever. */
export function deliverArgs(artifactPath: string, file: string): string[] {
  return ['deliver', '--secrets=stdin', `--artifact=${artifactPath}`, `--file=${file}`]
}

/** What goes into the engine's stdin: the secrets line, then the reports. */
export function deliverInput(secrets: Record<string, string>, reports: Record<string, string>): string {
  return secretsLine(secrets) + JSON.stringify({ schema: 1, reports })
}

/**
 * Reads the engine's answer. A refusal —the exam or the class changed since
 * the correction, a missing password— arrives as its own sentence.
 */
export function readDelivery(code: number | null, stdout: string, stderr: string): Delivery {
  if (code === OK || code === PARTIAL) {
    const raw = JSON.parse(stdout) as Partial<Delivery> & { kind?: unknown; delivery_version?: unknown }
    if (raw.kind !== 'delivery' || raw.delivery_version !== 1 || !Array.isArray(raw.students)) {
      throw new Error('El motor ha respondido algo que no es un envío de informes.')
    }
    return {
      file: String(raw.file ?? ''),
      students: raw.students.map((s) => ({
        student_id: String(s.student_id),
        name: String(s.name),
        delivered: s.delivered === true,
        reason: typeof s.reason === 'string' ? s.reason : undefined
      }))
    }
  }
  const said = stderr.trim().split('\n').filter(Boolean).pop()?.replace(/^heimdall deliver:\s*/, '')
  throw new Error(said || 'El motor no pudo enviar los informes.')
}

export function deliverReports(
  enginePath: string,
  artifactPath: string,
  file: string,
  secrets: Record<string, string>,
  reports: Record<string, string>
): Promise<Delivery> {
  return new Promise((resolve, reject) => {
    const child = spawn(enginePath, deliverArgs(artifactPath, file), { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_MS)
    child.stdout.setEncoding('utf-8')
    child.stdout.on('data', (chunk: string) => {
      if (stdout.length < MAX_OUTPUT) stdout += chunk
    })
    child.stderr.setEncoding('utf-8')
    child.stderr.on('data', (chunk: string) => {
      if (stderr.length < 8 << 10) stderr += chunk
    })
    child.stdin.on('error', () => {
      // An engine that refused before reading: its stderr says why.
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(new Error(`No se pudo arrancar el motor: ${error.message}`))
    })
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      if (signal === 'SIGKILL') {
        reject(new Error('El envío de informes no terminó en 5 minutos y se ha detenido.'))
        return
      }
      try {
        resolve(readDelivery(code, stdout, stderr))
      } catch (error) {
        reject(error)
      }
    })
    // The password leaves this process here and nowhere else.
    child.stdin.end(deliverInput(secrets, reports))
  })
}
