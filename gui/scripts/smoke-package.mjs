// Observe the actual packaged renderer through its local DevTools endpoint.
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'

const [binary, mode = 'auto'] = process.argv.slice(2)
if (!binary || !['auto', 'sandbox', 'fallback'].includes(mode)) throw new Error('Usage: smoke-package.mjs binary auto|sandbox|fallback')
const profile = mkdtempSync(join(tmpdir(), 'heimdall-package-smoke-'))
const child = spawn(resolve(binary), [
  `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--disable-gpu',
  ...(mode === 'fallback' ? ['--no-sandbox'] : [])
], { stdio: ['ignore', 'pipe', 'pipe'] })
let log = ''
child.stdout.on('data', bytes => { log += bytes.toString() })
child.stderr.on('data', bytes => { log += bytes.toString() })
let socket
try {
  for (let attempt = 0; attempt < 60 && !/DevTools listening on ws:/.test(log) && child.exitCode === null; attempt++) await delay(100)
  const match = log.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/)
  assert(match, `No DevTools endpoint (exit ${child.exitCode}): ${log}`)
  let target
  for (let attempt = 0; attempt < 30; attempt++) {
    const targets = await (await fetch(`http://127.0.0.1:${match[1]}/json`)).json()
    target = targets.find(item => item.type === 'page' && item.url.startsWith('file:'))
    if (target) break
    await delay(100)
  }
  assert(target, `No packaged page: ${log}`)
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  async function inspect() {
    return await new Promise((resolve, reject) => {
      socket.onmessage = ({ data }) => {
        const answer = JSON.parse(data)
        if (answer.id === 1) {
          if (answer.error) reject(new Error(JSON.stringify(answer.error)))
          else resolve(answer.result.result.value)
        }
      }
      socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: {
        expression: '({title:document.title, api:typeof window.heimdall, text:document.body.innerText})', returnByValue: true
      } }))
    })
  }
  let page
  for (let attempt = 0; attempt < 30; attempt++) {
    page = await inspect()
    if (page.api === 'object' && page.text.includes('Heimdall')) break
    await delay(100)
  }
  assert.equal(page.api, 'object', `Preload unavailable: ${JSON.stringify(page)}`)
  assert(page.text.includes('Heimdall'), 'Application shell not rendered')
  assert.equal(child.exitCode, null, 'Application exited')
  console.log(`Package ${mode}: renderer and preload OK (${page.title})`)
} finally {
  socket?.close()
  child.kill('SIGTERM')
  await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(2000)])
  if (child.exitCode === null) child.kill('SIGKILL')
  await delay(100)
  rmSync(profile, { recursive: true, force: true })
}
