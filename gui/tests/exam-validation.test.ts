import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { IPC } from '../src/shared/ipc'

const handlers = new Map<string, (...args: any[]) => any>()
const profile = mkdtempSync(join(tmpdir(), 'heimdall-exam-validation-test-'))
let accepted = true
let temporary = ''
let source = ''
vi.mock('electron', () => ({
  app: { getPath: () => profile },
  ipcMain: { handle: (key: string, handler: (...args: any[]) => any) => handlers.set(key, handler) },
  dialog: {}, shell: {}, powerSaveBlocker: {}
}))
vi.mock('node:child_process', async (original) => ({
  ...await original<typeof import('node:child_process')>(),
  execFile: (_path: string, args: string[], _options: unknown, callback: (...args: any[]) => void) => {
    expect(args.slice(0, 2)).toEqual(['check', '--exam-only'])
    temporary = args[2]
    expect(readdirSync(temporary)).toEqual(['examen.yaml'])
    source = readFileSync(join(temporary, 'examen.yaml'), 'utf8')
    callback(accepted ? null : { code: 2 }, accepted ? 'Examen válido.' : '', accepted ? '' : `${temporary}/examen.yaml:8: error propio del examen`)
  }
}))
const { registerIpc } = await import('../src/main/ipc')

beforeAll(() => { registerIpc() })
beforeEach(() => {
  accepted = true
  writeFileSync(join(profile, 'examen.yaml'), 'examen: Anterior\n')
})
afterAll(() => { rmSync(profile, { recursive: true, force: true }) })

it('validates without classes, even if their file is corrupt, and saves the exact renamed YAML', async () => {
  writeFileSync(join(profile, 'classes.json'), '[corrupt')
  const examPath = join(profile, 'examen.yaml')
  const yaml = '# Conservar comentario\nexamen: "Nombre nuevo"\n'
  writeFileSync(examPath, 'examen: Anterior\n')
  const verdict = await handlers.get(IPC.validateExam)!(null, { examPath, yaml })
  expect(verdict).toEqual({ ok: true, message: 'Examen válido.' })
  expect(source).toBe(yaml)
  expect(existsSync(temporary)).toBe(false)
  expect(readFileSync(examPath, 'utf8')).toBe('examen: Anterior\n')
  handlers.get(IPC.writeExam)!(null, examPath, yaml)
  expect(readFileSync(examPath, 'utf8')).toBe(yaml)
})

it('keeps validation errors with the original path and line and removes temporary files', async () => {
  accepted = false
  const examPath = join(profile, 'examen.yaml')
  const before = readFileSync(examPath, 'utf8')
  const verdict = await handlers.get(IPC.validateExam)!(null, { examPath, yaml: 'broken' })
  expect(verdict).toEqual({ ok: false, message: `${dirname(examPath)}/examen.yaml:8: error propio del examen` })
  expect(existsSync(temporary)).toBe(false)
  expect(readFileSync(examPath, 'utf8')).toBe(before)
})
