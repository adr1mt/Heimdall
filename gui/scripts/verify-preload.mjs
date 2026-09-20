import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = process.cwd()
const preloadPath = join(root, 'out', 'preload', 'index.cjs')
const mainPath = join(root, 'out', 'main', 'index.js')

try {
  await access(preloadPath)
} catch {
  throw new Error('Falta out/preload/index.cjs: un preload ESM no funciona con el sandbox activo.')
}

const [preload, main] = await Promise.all([
  readFile(preloadPath, 'utf-8'),
  readFile(mainPath, 'utf-8')
])

if (/^\s*import\s/m.test(preload)) {
  throw new Error('El preload contiene imports ESM y dejaría el renderer sandboxed sin window.heimdall.')
}
if (!main.includes('../preload/index.cjs')) {
  throw new Error('El proceso principal no apunta al preload CommonJS verificado.')
}

console.log('Preload sandboxed verificado: CommonJS único y ruta correcta.')
