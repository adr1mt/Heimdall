import { beforeEach, describe, expect, it } from 'vitest'
import { useRun } from '../src/renderer/src/stores/run'
import { validRun } from './fixtures/valid-run'

beforeEach(() => useRun.getState().reset())

describe('last validated result stays visible', () => {
  it('retains grades and artifact path through a refresh and failed launch', () => {
    const run = validRun()
    useRun.getState().setArtifact(run, '/first.json')
    useRun.getState().begin()
    expect(useRun.getState()).toMatchObject({ artifact: run, artifactPath: '/first.json', phase: 'starting' })
    useRun.getState().fail('No se pudo arrancar')
    expect(useRun.getState()).toMatchObject({ artifact: run, artifactPath: '/first.json', problem: 'No se pudo arrancar' })
  })
  it('retains the result when the event stream ends without run.end or the new artifact cannot be read', () => {
    const run = validRun()
    useRun.getState().setArtifact(run, '/first.json')
    useRun.getState().begin()
    useRun.getState().closed({ exitCode: 2, stderr: 'configuración inválida' })
    expect(useRun.getState().artifact).toBe(run)
    expect(useRun.getState().problem).toContain('configuración')
    useRun.getState().begin()
    useRun.getState().artifactFailed('No se pudo leer')
    expect(useRun.getState()).toMatchObject({ artifact: run, artifactPath: '/first.json', artifactProblem: 'No se pudo leer' })
  })
  it('replaces artifact and path together; resetting a context clears both and invalidates pending reads', () => {
    const first = validRun()
    const next = { ...validRun(), run_id: 'NEXT' }
    useRun.getState().setArtifact(first, '/first.json')
    useRun.getState().begin()
    useRun.getState().setArtifact(next, '/next.json')
    expect(useRun.getState()).toMatchObject({ artifact: next, artifactPath: '/next.json', artifactProblem: null })
    const revision = useRun.getState().revision
    useRun.getState().reset()
    expect(useRun.getState()).toMatchObject({ artifact: null, artifactPath: null, artifactProblem: null })
    expect(useRun.getState().revision).toBeGreaterThan(revision)
  })
})
