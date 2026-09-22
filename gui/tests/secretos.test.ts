import { describe, expect, it } from 'vitest'
import { aulaYaml } from '../src/shared/aula'
import { readGroup } from '../src/shared/classes'
import { runArgs, secretsLine } from '../src/main/run'
import { secretRefsIn } from '../src/main/secrets'
import { csvName, exportSummary, moodleCsv, moodleRows, gradeRows, toCsv } from '../src/renderer/src/lib/export'
import { SCALES } from '../src/renderer/src/lib/scale'
import { parseArtifact } from '../src/shared/artifact'
import type { ClassGroup } from '../src/shared/classes'

/**
 * End-to-end audit of the classroom password across the interface (T082).
 *
 * One poisoned value, and every document the application writes or hands to
 * the engine. The rule is not «it is hard to leak»: it is zero occurrences
 * (ADR-0009). The engine side of the same audit is `test/secrets.sh`.
 */
const SECRETO = 'HEIMDALL_SECRET_TEST_12345'

function clase(): ClassGroup {
  return {
    id: 'c1',
    name: '2SMX A',
    columns: ['subdominio'],
    students: [
      {
        id: 'alu1',
        name: 'Alumna Primera',
        contact: 'alu1@example.invalid',
        host: '127.1.2.3',
        port: '2201',
        user: 'alumno',
        fields: { subdominio: 'uno' }
      }
    ]
  }
}

/** An artifact whose output carries the password, as if nothing had redacted it. */
function artefacto(): string {
  return JSON.stringify({
    schema_version: 1,
    run_id: 'R1',
    engine_version: '0.1.0-dev',
    started_at: '2026-09-22T09:00:00Z',
    finished_at: '2026-09-22T09:00:10Z',
    status: 'COMPLETE',
    exam: { path: '/aula/examen.yaml', sha256: 'a'.repeat(64) },
    inventory: { path: '/aula/aula.yaml', sha256: 'b'.repeat(64) },
    plan_hash: 'c'.repeat(64),
    plan: {
      check_count: 1,
      total_weight: 1,
      check_ids: ['responde'],
      concurrency: 4,
      host_concurrency: 2
    },
    students: [
      {
        student_id: 'alu1',
        name: 'Alumna Primera',
        moodle_id: 'alu1@example.invalid',
        status: 'OK',
        started_at: '2026-09-22T09:00:00Z',
        finished_at: '2026-09-22T09:00:10Z',
        score: {
          obtained: 1,
          evaluable: 1,
          total: 1,
          unevaluated: 0,
          provisional_score: 100,
          final_score: 100,
          status: 'COMPLETE'
        },
        checks: [
          {
            check_id: 'responde',
            group: 'Primeras',
            description: 'La máquina responde',
            weight: 1,
            status: 'PASS',
            cause: 'NONE',
            execution: {
              host: 'host1',
              address: '127.1.2.3:2201',
              user: 'alumno',
              transport: 'ssh',
              command: ['hostname'],
              started_at: '2026-09-22T09:00:00Z',
              duration_ms: 12,
              completed: true,
              exit_code: 0,
              overflow: false,
              stdout: { text: `maquina1 ${SECRETO}`, bytes: 32, bytes_total: 32, truncated: false },
              stderr: { text: '', bytes: 0, bytes_total: 0, truncated: false },
              connect_attempts: 1,
              command_attempts: 1,
              remote_process: 'FINISHED'
            },
            assertion: { kind: 'exit_code', expected: '0', found: '0', matched: true }
          }
        ]
      }
    ]
  })
}

describe('la contraseña del aula, de punta a punta', () => {
  it('el aula generada lleva la referencia, nunca el valor', () => {
    const yaml = aulaYaml(clase())
    expect(yaml).toContain('password_ref: "${AULA_PASSWORD}"')
    expect(yaml).not.toContain(SECRETO)
    expect(secretRefsIn(yaml)).toEqual(['AULA_PASSWORD'])
  })

  it('una clase editada a mano con una contraseña dentro la pierde al leerla', () => {
    const group = readGroup({
      id: 'c1',
      name: '2SMX A',
      columns: [],
      students: [{ id: 'alu1', name: 'Alumna', user: 'alumno', password: SECRETO }]
    })
    expect(JSON.stringify(group)).not.toContain(SECRETO)
  })

  it('no viaja en los argumentos del motor: se leen con ps', () => {
    const args = runArgs({
      dir: '/aula/examen',
      className: 'aula-heimdall-2smx-a',
      retryFrom: '/aula/examen/var/run-R1.json',
      sessionRounds: ['/aula/examen/var/run-R0.json']
    })
    expect(args.join(' ')).not.toContain(SECRETO)
    expect(args).toContain('--secrets=stdin')
  })

  it('el único sitio por donde sale es la línea de stdin', () => {
    const line = secretsLine({ AULA_PASSWORD: SECRETO })
    expect(JSON.parse(line).secrets.AULA_PASSWORD).toBe(SECRETO)
    expect(line.endsWith('\n')).toBe(true)
  })

  it('lo que se exporta son notas: la salida de las máquinas no viaja', () => {
    const run = parseArtifact(artefacto())
    expect(run).not.toBeNull()
    const rows = gradeRows(run!, SCALES.ten)
    expect(toCsv(run!, SCALES.ten)).not.toContain(SECRETO)
    expect(moodleCsv(moodleRows(rows))).not.toContain(SECRETO)
    expect(exportSummary(run!, SCALES.ten)).not.toContain(SECRETO)
    expect(csvName(run!)).not.toContain(SECRETO)
  })
})
