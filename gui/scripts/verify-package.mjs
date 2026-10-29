// Verify the deliverable, not just a successful packager exit code.
import assert from 'node:assert/strict'
import { extractFile, listPackage } from '@electron/asar'
import { readFile, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const resources = join(root, 'dist/linux-unpacked/resources')
const archive = join(resources, 'app.asar')
async function compareTree(directory, relative = '') {
  let count = 0
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = join(relative, entry.name)
    if (entry.isDirectory()) count += await compareTree(join(directory, entry.name), name)
    else {
      assert.deepEqual(extractFile(archive, `out/${name}`), await readFile(join(directory, entry.name)), `Packaged output differs: ${name}`)
      count++
    }
  }
  return count
}
const count = await compareTree(join(root, 'out'))
assert(count > 0)
assert.deepEqual(await readFile(join(resources, 'heimdall')), await readFile(join(root, '../bin/heimdall')), 'Bundled engine differs')
assert.deepEqual(await readFile(join(resources, 'icon.png')), await readFile(join(root, 'build/icon.png')))
const pkg = JSON.parse(extractFile(archive, 'package.json').toString())
assert.equal(pkg.name, 'heimdall-gui', 'Keep the existing user profile identity')
assert.equal(pkg.version, JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version)
const modules = listPackage(archive).filter(path => /^\/node_modules\/(?:@[^/]+\/)?[^/]+\/package.json$/.test(path))
assert.deepEqual(modules.sort(), ['/node_modules/argparse/package.json', '/node_modules/js-yaml/package.json'])
assert(!pkg.devDependencies)
assert(extractFile(archive, 'out/main/index.js').toString().includes('../preload/index.cjs'))
assert(!/^\s*import\s/m.test(extractFile(archive, 'out/preload/index.cjs').toString()))
assert(extractFile(archive, 'out/renderer/index.html').toString().includes("script-src 'self' blob:"))
console.log(`Package content: ${count} compiled files, engine, icon, profile identity, CSP and two production dependencies verified`)
