// Shared opening of the two lab harnesses: the exam is opened in Inicio and
// the class is chosen in Corregir. Not part of the application.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The class of the lab, written where the application keeps the teacher's
 * classes (ADR-0021). Fictional students, the two containers of test/lab.sh:
 * `alumne02` points at a closed port on purpose.
 */
export function writeLabClass(userData: string, id = 'clase-laboratorio'): string {
  const student = (
    studentId: string,
    name: string,
    port: string
  ): Record<string, unknown> => ({
    id: studentId,
    name,
    contact: '',
    host: '127.1.2.3',
    port,
    user: 'alumno',
    fields: {}
  })
  mkdirSync(userData, { recursive: true })
  writeFileSync(
    join(userData, 'classes.json'),
    `${JSON.stringify(
      {
        classes: [
          {
            id,
            name: 'Laboratorio',
            columns: [],
            students: [
              student('alumne01', 'Alumna Uno', '2201'),
              student('alumne02', 'Alumne Dos', '2299')
            ]
          }
        ]
      },
      null,
      2
    )}\n`,
    'utf-8'
  )
  return id
}

type Js = (code: string) => Promise<unknown>

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * Opens the project in Inicio, chooses the class in Corregir and types the
 * password, the way a teacher does it: the values go through real events, so
 * React sees exactly what it would see from a keyboard and a mouse.
 *
 * Opening the project lands on «Corregir» on its own; the click on the menu
 * is there so a change of that landing does not silently break the harness.
 */
export async function openExamAndClass(js: Js, classId: string, secret: string): Promise<void> {
  await js(`[...document.querySelectorAll('header button')].find(b => b.textContent.includes('Abrir')).click()`)
  await wait(900)
  await js(`[...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Corregir').click()`)
  await wait(600)
  await js(`(() => {
    const select = document.querySelector('select')
    if (!select) return 'sin selector de clase'
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
    setter.call(select, ${JSON.stringify(classId)})
    select.dispatchEvent(new Event('change', { bubbles: true }))
    return 'ok'
  })()`)
  await wait(800)
  await js(`(() => {
    const input = document.querySelector('input[type=password]')
    if (!input) return 'sin campo de contraseña'
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, ${JSON.stringify(secret)})
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return 'ok'
  })()`)
  await wait(300)
}
