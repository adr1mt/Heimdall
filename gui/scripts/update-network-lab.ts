/** Real Electron/Chromium transport, including a Brotli HTTP response. */
import { app, net } from 'electron'
import { createServer } from 'node:http'
import { brotliCompressSync } from 'node:zlib'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { downloadUpdate } from '../src/main/update-download'

app.disableHardwareAcceleration()
const dir = mkdtempSync(join(tmpdir(), 'heimdall-chromium-'))
const text = 'Heimdall fictional update transport fixture\n'
const server = createServer((_req, res) => {
  res.writeHead(200, { 'content-encoding': 'br' })
  res.end(brotliCompressSync(text))
})
async function run(): Promise<void> {
try {
  await new Promise<void>(resolve => server.listen(0, '127.1.2.3', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('No local server')
  globalThis.fetch = async () => { throw new Error('Node fetch reached') }
  const dest = join(dir, 'fixture.AppImage')
  await downloadUpdate(`http://127.1.2.3:${address.port}/fixture`, dest, new AbortController().signal,
    (url, init) => net.fetch(url, init), { stallMs: 5000, deadlineMs: 10000 })
  if (readFileSync(dest, 'utf8') !== text) throw new Error('Downloaded bytes differ')
  console.log(`Chromium transport OK; Electron ${process.versions.electron}, Node ${process.versions.node}; Brotli response decoded without Node fetch`)
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  server.close()
  rmSync(dir, { recursive: true, force: true })
  app.exit(process.exitCode ?? 0)
}

}
void app.whenReady().then(run)
