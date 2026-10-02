import { chmodSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { IPC } from '../src/shared/ipc'
import { validRun } from './fixtures/valid-run'

const state = vi.hoisted(() => ({ data: '', handlers: new Map<string, (...args: any[]) => any>(), warnings: vi.fn() }))
vi.mock('electron', () => ({
  app: { getPath: () => state.data },
  ipcMain: { handle: (key: string, handler: (...args: any[]) => any) => state.handlers.set(key, handler) },
  dialog: { showMessageBoxSync: state.warnings },
  powerSaveBlocker: { isStarted: () => false, start: () => 1, stop: () => {} }, shell: {}
}))
let root = ''
afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }) })

it.each(['active', 'between', 'copying', 'failure'])('closing waits for grades and backups: %s', async mode => {
  vi.resetModules()
  state.warnings.mockClear()
  root = mkdtempSync(join(tmpdir(), 'heimdall-shutdown-'))
  state.data = join(root, 'profile')
  const project = join(root, 'project'), exam = join(project, 'examen.yaml')
  mkdirSync(state.data); mkdirSync(join(project, 'var'), { recursive: true })
  writeFileSync(exam, 'examen: Ficticio\n')
  const run = validRun(), result = join(project, 'var', 'run-R1.json')
  const engine = join(root, 'engine.cjs')
  // Final grades appear only after SIGINT; the actual child then takes time
  // to exit. Shutdown must wait for that exit before awaiting its copy.
  writeFileSync(engine, `#!/usr/bin/env node\nprocess.stdin.resume();process.on('SIGINT',()=>{require('node:fs').writeFileSync(${JSON.stringify(result)},${JSON.stringify(JSON.stringify(run))});setTimeout(()=>process.exit(4),40)});setInterval(()=>{},1000);console.log(JSON.stringify({event:'student.start',seq:1,ts:'t',student_id:'fake',name:'Ficticio'}));`)
  chmodSync(engine, 0o755)
  writeFileSync(join(state.data, 'settings.json'), JSON.stringify({ enginePath: engine }))
  writeFileSync(join(state.data, 'classes.json'), JSON.stringify({classes:[{id:'fake',name:'Ficticia',columns:[],students:[{id:'fake',name:'Ficticio',contact:'',host:'127.1.2.3',port:'2201',user:'alumno',fields:{}}]}]}))
  const ipc = await import('../src/main/ipc')
  const backup = await import('../src/main/backup')
  ipc.registerIpc()
  if (mode === 'active' || mode === 'failure') {
    await new Promise<void>(resolve => {
      state.handlers.get(IPC.startRun)!({ sender: { isDestroyed: () => false, send: (channel: string) => { if(channel === IPC.runEvent) resolve() } } }, {examPath:exam,classId:'fake',secrets:{}})
    })
  } else {
    writeFileSync(result, JSON.stringify(run))
    if (mode === 'between') state.handlers.get(IPC.setExamMode)!(null, {active:true,secrets:{}})
    void backup.backupRuns(state.data, exam)
  }
  if (mode === 'failure') writeFileSync(join(state.data, 'copias'), 'destination blocked')
  await ipc.finishCorrections()
  expect(ipc.isRunActive()).toBe(false)
  expect(ipc.isExamModeActive()).toBe(false)
  expect(backup.hasPendingBackups()).toBe(false)
  expect(JSON.parse(readFileSync(result, 'utf8')).run_id).toBe('R1')
  if (mode === 'failure') expect(state.warnings).toHaveBeenCalledOnce()
  else {
    rmSync(join(project, 'var'), {recursive:true})
    expect(backup.restoreBackups(state.data, exam).restored).toBe(1)
    expect(JSON.parse(readFileSync(result, 'utf8')).students[0].score.final_score).toBe(100)
  }
  expect(() => state.handlers.get(IPC.startRun)!({}, {examPath:exam,classId:'fake',secrets:{}})).toThrow(/cerrando/)
})
