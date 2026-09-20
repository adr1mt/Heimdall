import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DEFAULT_ENGINE_PATH } from './engine'

/**
 * The teacher's settings. Nothing here can reach a grade: these are
 * preferences of the machine the application runs on. It stores no secret
 * (ADR-0009).
 */
export interface Settings {
  /** Which binary the engine is launched with. */
  enginePath: string
}

const DEFAULTS: Settings = { enginePath: DEFAULT_ENGINE_PATH }

export function settingsFile(dir: string): string {
  return join(dir, 'settings.json')
}

export function readSettings(dir: string): Settings {
  try {
    const raw = JSON.parse(readFileSync(settingsFile(dir), 'utf-8')) as Partial<Settings>
    const enginePath =
      typeof raw.enginePath === 'string' && raw.enginePath.trim()
        ? raw.enginePath.trim()
        : DEFAULTS.enginePath
    return { enginePath }
  } catch {
    // Unreadable settings must never keep the application from opening.
    return { ...DEFAULTS }
  }
}

/** Atomic write: a power cut never leaves a half-written settings file. */
export function writeSettings(dir: string, settings: Settings): void {
  mkdirSync(dirname(settingsFile(dir)), { recursive: true })
  const tmp = `${settingsFile(dir)}.tmp`
  writeFileSync(tmp, `${JSON.stringify(settings, null, 2)}\n`, 'utf-8')
  renameSync(tmp, settingsFile(dir))
}
