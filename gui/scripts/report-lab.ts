// T188: each student's report, left over SSH in the home directory of their own
// machine. Real IPC, preload, renderer and engine; only the native folder
// dialog is stubbed. Two extra lab machines are started from the lab image so
// that every student has a machine of their own, and the file is read back
// from each machine with podman, not through Heimdall. Writes screenshots to
// docs/reviews/evidence/T188. Run from gui/ after build, with `make lab` up.
import { app, BrowserWindow, dialog } from 'electron'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
import { registerIpc } from '../src/main/ipc'

const SECRET = process.env.LAB_SECRET || 'HEIMDALL_SECRET_TEST_12345'
const base = mkdtempSync(join(tmpdir(), 'heimdall-send-'))
const project = join(base, 'redes-demo')
const profile = join(base, 'profile')
const out = resolve('../docs/reviews/evidence/T188')
for (const dir of [project, profile]) mkdirSync(dir)
mkdirSync(out, { recursive: true })

// One machine per student: the lab's alu1 plus two more from the same image.
// Diego's machine (2299) is off.
const MACHINES = ['alu1', 'heimdall-envio-2', 'heimdall-envio-3']
const podman = (...args: string[]) => execFileSync('podman', args, { encoding: 'utf8' })
for (const [i, name] of MACHINES.slice(1).entries()) {
  podman('run', '-d', '--replace', '--name', name, '--hostname', name, '-p', `127.1.2.3:${2202 + i}:22`, 'heimdall-lab-ssh')
}
const FILE = 'informe-practica-3-servicios-de-red.html'
// An old report of the same exam on Ana's machine: it must be replaced.
podman('exec', '-u', 'alumno', 'alu1', 'sh', '-c', `printf 'informe viejo' > /home/alumno/${FILE}`)
for (const name of MACHINES.slice(1)) podman('exec', name, 'rm', '-f', `/home/alumno/${FILE}`)

const names = ['Ana Demo', 'Bruno Demo', 'Carla Demo', 'Diego Demo']
const expected = ['443', '22', '53', 'dhcp', 'dns']
const labels = [
  'El servicio web escucha en el puerto de HTTPS',
  'El acceso remoto usa el puerto de SSH',
  'El servidor de nombres escucha en el puerto 53',
  'La red reparte direcciones IP de forma automática',
  'Los nombres de las máquinas se resuelven'
]
// What a machine answers when the student got it wrong: it must never reach a report.
const WRONG = 'SALIDA-DE-MAQUINA-INCORRECTA'
const students = names.map((name, index) => ({
  id: `alu${index + 1}`,
  name,
  contact: `alu${index + 1}@example.invalid`,
  host: '127.1.2.3',
  // Diego's machine is off: his checks cannot be looked at.
  port: String(index === 3 ? 2299 : 2201 + index),
  user: 'alumno',
  fields: Object.fromEntries(expected.map((value, i) => [`p${i + 1}`, i < 5 - index * 2 ? value : WRONG]))
}))
writeFileSync(
  join(profile, 'classes.json'),
  JSON.stringify({
    classes: [{ id: 'demo', name: 'Clase demo', columns: ['p1', 'p2', 'p3', 'p4', 'p5'], password: SECRET, students }]
  })
)
writeFileSync(
  join(profile, 'settings.json'),
  JSON.stringify({ enginePath: resolve(process.env.HEIMDALL_ENGINE || '../bin/heimdall') })
)
const check = (i: number) =>
  `      - id: p${i + 1}\n        descripcion: ${labels[i]}\n        en: host1\n        cmd: ["echo", "\u0024{alumno.p${i + 1}}"]\n        igual_a: "${expected[i]}"\n`
writeFileSync(
  join(project, 'examen.yaml'),
  'examen: "Práctica 3 · Servicios de red"\nversion: 1\nhosts: [host1]\npor_defecto: { peso: 1, timeout: 10s }\ngrupos:\n' +
    '  - grupo: Puertos de servicio\n    comprobaciones:\n' + [0, 1, 2].map(check).join('') +
    '  - grupo: DHCP y DNS\n    comprobaciones:\n' + [3, 4].map(check).join('')
)

app.setPath('userData', profile)
app.disableHardwareAcceleration()
dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [project] })) as never

// Every process alive while the reports are sent: none may carry the password.
// The harness's own ancestors are left out: make hands LAB_SECRET to the shell
// that starts it, and that is the test's doing, not Heimdall's.
const ancestors = new Set<string>()
for (let pid = String(process.pid); pid !== '0' && pid !== '1'; ) {
  ancestors.add(pid)
  pid = readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ')[1]
}
const leaks: string[] = []
let watching = true
async function watchArgv() {
  while (watching) {
    for (const pid of readdirSync('/proc').filter((p) => /^\d+$/.test(p))) {
      try {
        const cmd = readFileSync(`/proc/${pid}/cmdline`, 'utf8')
        if (cmd.includes(SECRET) && !ancestors.has(pid)) leaks.push(`${pid}: ${cmd.split('\0')[0]}`)
        if (cmd.includes('\0deliver\0')) engineSeen.add(pid)
      } catch {
        // gone already
      }
    }
    await delay(20)
  }
}
const engineSeen = new Set<string>()

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
let win: BrowserWindow
const js = (code: string): Promise<any> => win.webContents.executeJavaScript(code)
const text = () => js('document.body.innerText') as Promise<string>
async function until(code: string, label: string, timeout = 40000) {
  for (let i = 0; i < timeout / 100; i++) {
    if (await js(code)) return
    await delay(100)
  }
  throw new Error(`Timed out: ${label}\n${await text()}`)
}
async function click(label: string, selector = 'button') {
  await js(
    `(() => {const b=[...document.querySelectorAll(${JSON.stringify(selector)})].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b || b.disabled)throw Error('Button unavailable: '+${JSON.stringify(label)});b.click()})()`
  )
  await delay(200)
}
async function shot(w: BrowserWindow, name: string) {
  await delay(500)
  writeFileSync(join(out, `${name}.png`), (await w.webContents.capturePage()).toPNG())
}

app
  .whenReady()
  .then(async () => {
    registerIpc()
    win = new BrowserWindow({
      width: 1280,
      height: 860,
      autoHideMenuBar: true,
      webPreferences: { preload: resolve('out/preload/index.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false }
    })
    const consoleErrors: string[] = []
    win.webContents.on('console-message', (_e, level, message) => {
      if (level >= 2) consoleErrors.push(message)
    })
    await win.loadFile(resolve('out/renderer/index.html'))
    await until("!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Abrir…')", 'home')
    await click('Abrir…')
    await until("!!document.querySelector('select')", 'class chooser')
    await js(
      `(()=>{const e=document.querySelector('select[aria-label]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,'demo');e.dispatchEvent(new Event('change',{bubbles:true}));})()`
    )
    await delay(400)
    await click('Corregir', 'header button')
    await until("document.querySelector('header h1')?.textContent === 'Resultados'", 'results')
    const runs = readdirSync(join(project, 'var')).filter((f) => f.startsWith('run-'))
    assert.equal(runs.length, 1)
    const artifact = JSON.parse(readFileSync(join(project, 'var', runs[0]), 'utf8'))

    await click('Enviar informes…')
    await until("document.body.innerText.includes('carpeta personal')", 'confirmation')
    await shot(win, '01-confirmacion')
    const asked = await text()
    assert.match(asked, /4 alumnos, cada uno con su informe/)
    assert.ok(asked.includes(`«${FILE}»`))

    const watcher = watchArgv()
    const started = Date.now()
    await click('Enviar')
    await until("document.body.innerText.includes('Informe entregado a')", 'delivery', 120000)
    const seconds = (Date.now() - started) / 1000
    let secondSeconds = 0
    await shot(win, '02-resultado')
    const told = await text()
    assert.match(told, /Informe entregado a 3 de 4 alumnos/)
    assert.match(told, /No le ha llegado\s+Diego Demo · en esta corrección no se llegó a conectar con su máquina/)
    assert.match(told, /Le ha llegado\s+Ana Demo · Bruno Demo · Carla Demo/)

    // A second send replaces the same file. Carla's machine was corrected but
    // is off now: she is told apart, with the reason, and nobody waits for her.
    podman('stop', '-t', '0', MACHINES[2])
    const again = Date.now()
    await click('Volver a enviar')
    await until("document.body.innerText.includes('Informe entregado a 2 de 4')", 'second delivery', 120000)
    secondSeconds = (Date.now() - again) / 1000
    await shot(win, '03-maquina-apagada-al-enviar')
    const second = await text()
    assert.match(second, /Carla Demo · no se ha podido conectar con 127\.1\.2\.3:2203/)
    assert.match(second, /Le ha llegado\s+Ana Demo · Bruno Demo/)
    assert.ok(secondSeconds < 60, `the second send took ${secondSeconds}s`)
    podman('start', MACHINES[2])
    for (let i = 0; i < 50 && !podman('exec', MACHINES[2], 'sh', '-c', 'test -s /run/sshd.pid && echo y || true').trim(); i++) await delay(100)
    watching = false
    await watcher
    assert.ok(engineSeen.size >= 1, 'the engine was not seen running')
    assert.deepEqual(leaks, [], 'password in argv')
    await click('Cerrar')

    // Read back from each machine with podman, not through Heimdall.
    const files: string[] = []
    for (const [i, machine] of MACHINES.entries()) {
      const [mode, owner] = podman('exec', machine, 'stat', '-c', '%a %U', `/home/alumno/${FILE}`).trim().split(' ')
      assert.equal(mode, '644', `${machine}: permissions`)
      assert.equal(owner, 'alumno', `${machine}: owner`)
      assert.equal(podman('exec', machine, 'sh', '-c', 'ls -a /home/alumno | grep -c "^.heimdall-" || true').trim(), '0', `${machine}: temporary left`)
      const html = podman('exec', machine, 'cat', `/home/alumno/${FILE}`)
      const local = join(base, `${machine}.html`)
      writeFileSync(local, html)
      files.push(local)
      assert.ok(!html.includes('informe viejo'), `${machine}: old report not replaced`)
      assert.ok(!html.includes(SECRET), `${machine}: password`)
      assert.ok(!html.includes(WRONG), `${machine}: machine output`)
      assert.ok(!html.includes('echo'), `${machine}: command`)
      assert.ok(!html.includes('127.1.2.3'), `${machine}: address`)
      for (const [j, other] of names.entries()) assert.equal(html.includes(other), i === j, `${machine}: ${other}`)
      assert.match(html, /Práctica 3 · Servicios de red/)
    }

    // Nothing on this computer carries the password but the class itself
    // (ADR-0030): not the exam folder, not the results, not a report.
    const written = execFileSync('grep', ['-rl', SECRET, base], { encoding: 'utf8' }).trim().split('\n')
    assert.deepEqual(written, [join(profile, 'classes.json')])

    const viewer = new BrowserWindow({ width: 900, height: 1200, show: true, webPreferences: { javascript: false } })
    await viewer.loadFile(files[1])
    await shot(viewer, '04-informe-en-la-maquina-de-bruno')
    viewer.setSize(390, 1400)
    await shot(viewer, '05-informe-movil')

    assert.deepEqual(consoleErrors, [])
    const result = {
      ok: true,
      file: FILE,
      run_id: artifact.run_id,
      delivered_to: MACHINES,
      not_delivered: ['Diego Demo (máquina apagada)'],
      first_send_seconds: seconds,
      second_send_seconds_with_carla_off: secondSeconds,
      engine_processes_seen: engineSeen.size,
      password_in_argv: leaks.length,
      consoleErrors
    }
    writeFileSync(join(out, 'verification.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify(result))
    for (const name of MACHINES.slice(1)) podman('rm', '-f', name)
    app.quit()
  })
  .catch(async (error) => {
    for (const name of MACHINES.slice(1)) podman('rm', '-f', name)
    console.error(error)
    if (win) console.error(await text().catch(() => ''))
    app.exit(1)
  })
