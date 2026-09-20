import { describe, expect, it } from 'vitest'
import { LineSplitter, resolveRunTarget, runArgs, secretsLine } from '../src/main/run'
import { secretRefsIn } from '../src/main/secrets'
import { parseEvent } from '../src/shared/events'

describe('resolveRunTarget', () => {
  it('takes the directory of the exam and the name of the classroom', () => {
    expect(resolveRunTarget('/aula/p1/examen.yaml', '/aula/p1/smx2.yaml')).toEqual({
      dir: '/aula/p1',
      className: 'smx2.yaml'
    })
  })

  it('refuses an exam that is not examen.yaml', () => {
    expect(() => resolveRunTarget('/aula/p1/practica.yaml', '/aula/p1/aula.yaml')).toThrow(
      /examen\.yaml/
    )
  })

  it('refuses a classroom from another folder', () => {
    expect(() => resolveRunTarget('/aula/p1/examen.yaml', '/otro/aula.yaml')).toThrow(/misma carpeta/)
  })
})

describe('runArgs', () => {
  const args = runArgs({ dir: '/aula/p1', className: 'smx2.yaml' })

  it('asks for the native stream and reads the secrets from stdin', () => {
    expect(args).toContain('--events=ndjson')
    expect(args).toContain('--secrets=stdin')
  })

  it('never carries a secret, whatever the values are', () => {
    // argv is readable with ps by any user of the machine (ADR-0009).
    expect(args.join(' ')).not.toMatch(/secreto|password/i)
  })

  it('names the classroom file and writes the artifact next to the exam', () => {
    expect(args).toContain('--cname=smx2.yaml')
    expect(args).toContain('--var=/aula/p1/var')
    expect(args[args.length - 1]).toBe('/aula/p1')
  })

  it('does not ask for a retry unless one was asked for', () => {
    expect(args.some((a) => a.startsWith('--retry='))).toBe(false)
  })

  it('names the previous artifact and nothing else when repeating', () => {
    const retry = runArgs({
      dir: '/aula/p1',
      className: 'smx2.yaml',
      retryFrom: '/aula/p1/var/run-01M2Y.json'
    })
    expect(retry).toContain('--retry=/aula/p1/var/run-01M2Y.json')
    // The engine picks which checks get repeated; the interface never sends a
    // list of students or of checks (ADR-0018).
    expect(retry.some((a) => a.startsWith('--case='))).toBe(false)
    expect(retry[retry.length - 1]).toBe('/aula/p1')
  })
})

describe('secretsLine', () => {
  it('is one line of JSON with the schema the engine expects', () => {
    const line = secretsLine({ AULA_PASSWORD: 'con "comillas" y \n salto' })
    expect(line.endsWith('\n')).toBe(true)
    expect(line.trimEnd().includes('\n')).toBe(false)
    expect(JSON.parse(line)).toEqual({
      schema: 1,
      secrets: { AULA_PASSWORD: 'con "comillas" y \n salto' }
    })
  })
})

describe('LineSplitter', () => {
  it('rebuilds lines that arrive cut in the middle', () => {
    const lines: string[] = []
    const splitter = new LineSplitter()
    splitter.push('{"a":1}\n{"b', (l) => lines.push(l))
    splitter.push('":2}\n', (l) => lines.push(l))
    expect(lines).toEqual(['{"a":1}', '{"b":2}'])
  })

  it('hands over the last line when the engine ends without a newline', () => {
    const lines: string[] = []
    const splitter = new LineSplitter()
    splitter.push('{"a":1}', (l) => lines.push(l))
    splitter.flush((l) => lines.push(l))
    expect(lines).toEqual(['{"a":1}'])
  })

  it('drops a runaway line instead of growing without bound', () => {
    const lines: string[] = []
    const splitter = new LineSplitter()
    splitter.push('x'.repeat((1 << 20) + 10), (l) => lines.push(l))
    splitter.push('resto\n{"a":1}\n', (l) => lines.push(l))
    expect(lines).toEqual(['{"a":1}'])
  })
})

describe('parseEvent', () => {
  it('reads an event of the contract', () => {
    const event = parseEvent('{"event":"check.end","seq":4,"ts":"t","student_id":"a","status":"PASS"}')
    expect(event?.event).toBe('check.end')
  })

  it('ignores what it does not know instead of failing', () => {
    // The contract says a new event must not break a consumer (§5).
    expect(parseEvent('{"event":"machine.identity","seq":9,"ts":"t"}')).toBeNull()
    expect(parseEvent('no es json')).toBeNull()
    expect(parseEvent('')).toBeNull()
    expect(parseEvent('"una cadena"')).toBeNull()
  })
})

describe('secretRefsIn', () => {
  it('names each credential the classroom asks for, once and in order', () => {
    const inventory = [
      'alumnos:',
      '  - id: alu1',
      '    password_ref: "${AULA_PASSWORD}"',
      '  - id: alu2',
      '    password_ref: "${OTRA_CLAVE}"',
      '  - id: alu3',
      '    password_ref: "${AULA_PASSWORD}"'
    ].join('\n')
    expect(secretRefsIn(inventory)).toEqual(['AULA_PASSWORD', 'OTRA_CLAVE'])
  })

  it('asks for nothing when there is no reference', () => {
    expect(secretRefsIn('alumnos: []\n')).toEqual([])
  })
})
