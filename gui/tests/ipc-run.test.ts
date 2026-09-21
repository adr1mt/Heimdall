/**
 * What the engine really receives when the teacher presses «Corregir», and
 * when a round of the exam goes out on its own.
 *
 * The engine here is a script that writes down its argv and the line it was
 * given on stdin, so the test reads exactly what a real engine would read.
 * Electron is replaced because none of this needs a window: the part under
 * test is the main process deciding what to hand over.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { IPC } from '../src/shared/ipc'

type Handler = (event: unknown, request: unknown) => unknown

const handlers = new Map<string, Handler>()
const userData = mkdtempSync(join(tmpdir(), 'heimdall-ipc-'))

vi.mock('electron', () => ({
  app: { getPath: (): string => userData },
  dialog: {},
  ipcMain: {
    handle: (channel: string, handler: Handler): void => {
      handlers.set(channel, handler)
    }
  },
  powerSaveBlocker: { start: (): number => 1, stop: (): void => {}, isStarted: (): boolean => false },
  shell: {}
}))

const { registerIpc, endExamMode } = await import('../src/main/ipc')

/** Where the fake engine leaves what it was given. */
const received = join(userData, 'recibido.txt')

/** The exam folder the two paths point at. Nothing reads them: it never runs. */
const project = mkdtempSync(join(tmpdir(), 'heimdall-examen-'))
const examPath = join(project, 'examen.yaml')
const classPath = join(project, 'aula.yaml')

beforeAll(() => {
  writeFileSync(examPath, 'examen: "Prueba"\n', 'utf-8')
  writeFileSync(classPath, 'aula: "Prueba"\n', 'utf-8')

  const engine = join(userData, 'heimdall')
  writeFileSync(engine, `#!/bin/sh\necho "$@" > "${received}"\nhead -n 1 >> "${received}"\n`, 'utf-8')
  chmodSync(engine, 0o755)
  writeFileSync(join(userData, 'settings.json'), JSON.stringify({ enginePath: engine }), 'utf-8')

  registerIpc()
})

afterEach(() => {
  endExamMode()
})

/** Starts a run and gives back argv and the stdin line the engine got. */
async function startRun(secrets: Record<string, string>): Promise<{ argv: string; line: string }> {
  writeFileSync(received, '', 'utf-8')
  const closed = new Promise<void>((resolve) => {
    const sender = {
      isDestroyed: (): boolean => false,
      send: (channel: string): void => {
        if (channel === IPC.runClosed) resolve()
      }
    }
    handlers.get(IPC.startRun)!({ sender }, { examPath, classPath, secrets })
  })
  await closed
  const [argv = '', line = ''] = readFileSync(received, 'utf-8').split('\n')
  return { argv, line }
}

describe('el botón Corregir', () => {
  it('corrige un aula sin ninguna contraseña, con el sobre vacío', async () => {
    const { line } = await startRun({})
    expect(JSON.parse(line)).toEqual({ schema: 1, secrets: {} })
  })

  it('corrige un aula con contraseña igual que siempre, y nunca por argv', async () => {
    const { argv, line } = await startRun({ AULA_PASSWORD: 'secreto-ficticio' })
    expect(JSON.parse(line)).toEqual({ schema: 1, secrets: { AULA_PASSWORD: 'secreto-ficticio' } })
    // argv lo lee cualquier usuario de la máquina con ps (ADR-0009).
    expect(argv).not.toContain('secreto-ficticio')
    expect(argv).toContain('--secrets=stdin')
  })

  it('deja ver el error de una configuración inválida en vez de tragárselo', () => {
    const sender = { isDestroyed: (): boolean => false, send: (): void => {} }
    expect(() => handlers.get(IPC.startRun)!({ sender }, { classPath })).toThrow(/Falta el examen/)
    expect(() =>
      handlers.get(IPC.startRun)!(
        { sender },
        { examPath: join(project, 'practica.yaml'), classPath, secrets: {} }
      )
    ).toThrow(/examen\.yaml/)
  })

  it('no lanza un segundo motor encima del primero', async () => {
    const running = startRun({})
    expect(() =>
      handlers.get(IPC.startRun)!(
        { sender: { isDestroyed: (): boolean => false, send: (): void => {} } },
        { examPath, classPath, secrets: {} }
      )
    ).toThrow(/en marcha/)
    await running
  })
})

describe('el modo examen', () => {
  it('encadena vueltas de un aula sin contraseña con el mismo sobre vacío', async () => {
    handlers.get(IPC.setExamMode)!(null, { active: true, secrets: {} })
    const { line } = await startRun({})
    expect(JSON.parse(line)).toEqual({ schema: 1, secrets: {} })
  })

  it('guarda la contraseña del aula que sí la pide y la pasa a cada vuelta', async () => {
    handlers.get(IPC.setExamMode)!(null, { active: true, secrets: { AULA_PASSWORD: 'secreto-ficticio' } })
    // La interfaz no vuelve a mandar credenciales después de la primera vuelta.
    const { argv, line } = await startRun({})
    expect(JSON.parse(line)).toEqual({ schema: 1, secrets: { AULA_PASSWORD: 'secreto-ficticio' } })
    expect(argv).not.toContain('secreto-ficticio')
  })
})
