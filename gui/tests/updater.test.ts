import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Updater, isNewer, parseRelease, type UpdaterDeps } from '../src/main/updater'

// La actualización automática solo vale si nunca se pone delante de la clase.
// Estas pruebas vigilan las tres promesas: cero red mientras se corrige, nada
// se instala hasta cerrar, y un fallo no saca ningún diálogo.

let dir: string

function feed(version: string): string {
  return JSON.stringify({
    tag_name: `v${version}`,
    assets: [
      { browser_download_url: 'https://github.com/adr1mt/Heimdall/releases/notas.csv' },
      {
        browser_download_url: `https://github.com/adr1mt/Heimdall/releases/Heimdall-${version}.AppImage`
      }
    ]
  })
}

interface Harness {
  updater: Updater
  /** Cada URL que se le ha pedido a la red, en orden. */
  requests: string[]
  announced: string[]
  log: string[]
  appImage: string
  busy: boolean
}

function harness(overrides: Partial<UpdaterDeps> = {}, body = feed('0.2.0')): Harness {
  const requests: string[] = []
  const announced: string[] = []
  const log: string[] = []
  const appImage = join(dir, 'Heimdall.AppImage')
  writeFileSync(appImage, 'la versión que hay instalada')
  const state = { busy: false }
  const updater = new Updater({
    currentVersion: '0.1.0',
    appImagePath: appImage,
    downloadDir: join(dir, 'descargas'),
    busy: () => state.busy,
    fetchText: async (url) => {
      requests.push(url)
      return body
    },
    download: async (url, dest) => {
      requests.push(url)
      writeFileSync(dest, 'la versión nueva')
    },
    announce: (version) => announced.push(version),
    log: (message) => log.push(message),
    ...overrides
  })
  return {
    updater,
    requests,
    announced,
    log,
    appImage,
    get busy() {
      return state.busy
    },
    set busy(value: boolean) {
      state.busy = value
    }
  }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'heimdall-updater-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('comparar versiones', () => {
  it('ordena por números y no por texto', () => {
    expect(isNewer('1.10.0', '1.9.3')).toBe(true)
    expect(isNewer('0.2.0', '0.1.0')).toBe(true)
    expect(isNewer('0.1.0', '0.1.0')).toBe(false)
    expect(isNewer('0.1.0', '0.2.0')).toBe(false)
  })

  it('no ofrece una versión de pruebas', () => {
    expect(isNewer('1.0.0-rc1', '0.9.0')).toBe(false)
  })
})

describe('leer lo publicado', () => {
  it('se queda con la aplicación y descarta lo demás', () => {
    expect(parseRelease(feed('0.3.0'))).toEqual({
      version: '0.3.0',
      url: 'https://github.com/adr1mt/Heimdall/releases/Heimdall-0.3.0.AppImage'
    })
  })

  it('no acepta una descarga fuera del repositorio del proyecto', () => {
    const suplantada = JSON.stringify({
      tag_name: 'v9.9.9',
      assets: [{ browser_download_url: 'https://ejemplo.invalido/Heimdall-9.9.9.AppImage' }]
    })
    expect(parseRelease(suplantada)).toBeNull()
  })

  it('no acepta una respuesta rota ni una sin aplicación', () => {
    expect(parseRelease('<html>error</html>')).toBeNull()
    expect(parseRelease(JSON.stringify({ tag_name: 'v1.0.0', assets: [] }))).toBeNull()
  })
})

describe('mientras se corrige', () => {
  it('con el modo examen activo no hay ni una petición de red', async () => {
    const h = harness()
    h.busy = true
    expect(await h.updater.check()).toBe('busy')
    expect(h.requests).toEqual([])
    expect(h.updater.pendingVersion()).toBeNull()
  })

  it('en una instalación que no se actualiza sola tampoco pregunta', async () => {
    const h = harness({ appImagePath: null })
    expect(await h.updater.check()).toBe('unsupported')
    expect(h.requests).toEqual([])
  })
})

describe('la versión nueva', () => {
  it('se descarga, se avisa sin bloquear y no se instala hasta cerrar', async () => {
    const h = harness()
    expect(await h.updater.check()).toBe('ready')
    expect(h.announced).toEqual(['0.2.0'])
    expect(h.updater.pendingVersion()).toBe('0.2.0')
    // Nada ha tocado todavía la aplicación que se está usando.
    expect(readFileSync(h.appImage, 'utf-8')).toBe('la versión que hay instalada')

    expect(h.updater.applyOnQuit()).toBe(true)
    expect(readFileSync(h.appImage, 'utf-8')).toBe('la versión nueva')
    expect(h.updater.pendingVersion()).toBeNull()
  })

  it('no se descarga si no hay nada más nuevo', async () => {
    const h = harness({}, feed('0.1.0'))
    expect(await h.updater.check()).toBe('current')
    expect(h.announced).toEqual([])
    expect(h.updater.applyOnQuit()).toBe(false)
  })

  it('no se descarga dos veces cuando ya está esperando', async () => {
    const h = harness()
    await h.updater.check()
    const pedidas = h.requests.length
    expect(await h.updater.check()).toBe('ready')
    expect(h.requests.length).toBe(pedidas)
  })
})

describe('cuando algo falla', () => {
  it('sin red arranca igual, se registra y no se avisa a nadie', async () => {
    const h = harness({
      fetchText: async () => {
        throw new Error('getaddrinfo ENOTFOUND api.github.com')
      }
    })
    expect(await h.updater.check()).toBe('failed')
    expect(h.announced).toEqual([])
    expect(h.log.join(' ')).toContain('no se pudo comprobar')
    expect(readFileSync(h.appImage, 'utf-8')).toBe('la versión que hay instalada')
  })

  it('una descarga a medias no deja la aplicación rota', async () => {
    const h = harness({
      download: async () => {
        throw new Error('EACCES: permission denied')
      }
    })
    expect(await h.updater.check()).toBe('failed')
    expect(h.updater.pendingVersion()).toBeNull()
    expect(readFileSync(h.appImage, 'utf-8')).toBe('la versión que hay instalada')
  })

  it('si no se puede instalar al cerrar, se conserva la que funciona', async () => {
    const h = harness()
    await h.updater.check()
    // La descarga desaparece entre la comprobación y el cierre.
    rmSync(join(dir, 'descargas'), { recursive: true, force: true })
    expect(h.updater.applyOnQuit()).toBe(false)
    expect(readFileSync(h.appImage, 'utf-8')).toBe('la versión que hay instalada')
    expect(h.log.join(' ')).toContain('no se pudo instalar')
  })
})

it('does not download when a correction starts while the feed is pending', async () => {
  let h: Harness
  h = harness({ fetchText: async () => { h.busy = true; return feed('0.2.0') } })
  expect(await h.updater.check()).toBe('busy'); expect(h.requests).toEqual([]); expect(h.announced).toEqual([])
})
it('aborts an in-flight download when the correction begins', async () => {
  let startBusy: () => void = () => { }, h: Harness
  h = harness({    
onBusy: listener => { startBusy = listener; return () => { } }, download: async (_url, _dest, signal) => {
      h.busy = true; startBusy(); signal.throwIfAborted()
    }  
})
  expect(await h.updater.check()).toBe('busy'); expect(h.updater.pendingVersion()).toBeNull(); expect(h.announced).toEqual([])
  expect(readFileSync(h.appImage, 'utf8')).toBe('la versión que hay instalada')
})
it('does not announce a download completed while correction starts', async () => {
  let h: Harness
  h = harness({ download: async (_url, dest) => { writeFileSync(dest, 'new'); h.busy = true } })
  expect(await h.updater.check()).toBe('busy'); expect(h.announced).toEqual([]); expect(h.updater.pendingVersion()).toBeNull()
})
it('shares one pending check between concurrent callers', async () => {
  let release: () => void = () => { }
  const wait = new Promise<void>(resolve => { release = resolve })
  const h = harness({ fetchText: async () => { await wait; return feed('0.2.0') } })
  const first = h.updater.check(), second = h.updater.check()
  expect(second).toBe(first)
  release()
  expect(await first).toBe('ready'); expect(h.announced).toEqual(['0.2.0'])
})
