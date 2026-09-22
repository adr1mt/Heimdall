/**
 * Keeping the application up to date without ever getting in the way of a
 * correction.
 *
 * Three rules decide everything here, and they are the reason this is not
 * `electron-updater`:
 *
 *  1. While the class is being corrected —a run alive or exam mode on— there
 *     is not even a network request. Not a delayed one, not a silent one.
 *  2. Nothing is ever applied while the application is in use. The new
 *     version lands on disk and waits for the teacher to close the program.
 *  3. A failure updating is never a failure of the lesson: it is logged and
 *     nobody in front of the class sees a dialog about it.
 *
 * It takes everything it touches —the clock, the network, the disk, whether
 * a correction is alive— as arguments, so the tests drive the same code the
 * teacher gets without a network of their own.
 */

import { chmodSync, copyFileSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'

/** Where the released versions are published. */
export const RELEASE_FEED = 'https://api.github.com/repos/adr1mt/Heimdall/releases/latest'

/** Only the project's own release hosts. A feed cannot redirect us elsewhere. */
const ALLOWED_HOSTS = new Set(['github.com', 'api.github.com', 'objects.githubusercontent.com'])

/** What a release offers: a version and the file that carries it. */
export interface Release {
  version: string
  url: string
}

/**
 * A released version, as this updater accepts one: digits and dots.
 *
 * A release candidate is a version for whoever went looking for it, never
 * something a classroom machine installs on its own.
 */
const PLAIN_VERSION = /^\d+(\.\d+)*$/

/** `1.10.0` is newer than `1.9.3`: the parts are numbers, not text. */
export function isNewer(candidate: string, current: string): boolean {
  if (!PLAIN_VERSION.test(candidate) || !PLAIN_VERSION.test(current)) return false
  const a = candidate.split('.').map(Number)
  const b = current.split('.').map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const left = a[i] ?? 0
    const right = b[i] ?? 0
    if (left !== right) return left > right
  }
  return false
}

function isAllowed(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && ALLOWED_HOSTS.has(parsed.hostname)
  } catch {
    return false
  }
}

/**
 * The release inside the feed, or null when there is nothing installable in
 * it. A feed that is unreadable, that offers no AppImage or that points
 * anywhere but the project's releases is simply not an update.
 */
export function parseRelease(body: string): Release | null {
  let feed: { tag_name?: unknown; assets?: unknown }
  try {
    feed = JSON.parse(body) as typeof feed
  } catch {
    return null
  }
  const tag = typeof feed.tag_name === 'string' ? feed.tag_name.replace(/^v/, '').trim() : ''
  if (!PLAIN_VERSION.test(tag)) return null
  const assets = Array.isArray(feed.assets) ? feed.assets : []
  for (const asset of assets) {
    const url = (asset as { browser_download_url?: unknown }).browser_download_url
    if (typeof url !== 'string' || !url.endsWith('.AppImage')) continue
    if (!isAllowed(url)) continue
    return { version: tag, url }
  }
  return null
}

/** Everything the updater touches outside itself. */
export interface UpdaterDeps {
  /** The version running right now. */
  currentVersion: string
  /**
   * The AppImage the teacher launched, when that is how it was launched.
   * Null covers development and the `.deb`, which apt keeps up to date: there
   * is nothing for us to replace and we do not even look.
   */
  appImagePath: string | null
  /** Where a downloaded version waits for the application to close. */
  downloadDir: string
  /** True while a correction is alive or exam mode is on. */
  busy: () => boolean
  fetchText: (url: string) => Promise<string>
  /** Downloads `url` into `dest`. Whole file or nothing. */
  download: (url: string, dest: string) => Promise<void>
  /** Tells the teacher, without stopping them, that a version is waiting. */
  announce: (version: string) => void
  log: (message: string) => void
}

export type CheckOutcome =
  /** This installation does not update itself: nothing was asked of the network. */
  | 'unsupported'
  /** A correction is going on: nothing was asked of the network. */
  | 'busy'
  /** Asked, and there is nothing newer. */
  | 'current'
  /** Downloaded and waiting for the application to close. */
  | 'ready'
  /** Something went wrong. It is in the log and nowhere else. */
  | 'failed'

export class Updater {
  private pending: { version: string; file: string } | null = null

  constructor(private readonly deps: UpdaterDeps) {}

  /** The version waiting to be installed, if any. For the interface. */
  pendingVersion(): string | null {
    return this.pending?.version ?? null
  }

  async check(): Promise<CheckOutcome> {
    const { appImagePath, busy, log } = this.deps
    if (!appImagePath) return 'unsupported'
    // The guard comes before the request and not after it: in the middle of an
    // exam the network belongs to the correction.
    if (busy()) return 'busy'
    if (this.pending) return 'ready'

    try {
      const release = parseRelease(await this.deps.fetchText(RELEASE_FEED))
      if (!release) {
        log('no hay ninguna versión publicada que se pueda instalar')
        return 'current'
      }
      if (!isNewer(release.version, this.deps.currentVersion)) return 'current'

      const file = join(this.deps.downloadDir, `Heimdall-${release.version}.AppImage`)
      mkdirSync(this.deps.downloadDir, { recursive: true })
      await this.deps.download(release.url, file)
      this.pending = { version: release.version, file }
      this.deps.announce(release.version)
      return 'ready'
    } catch (error) {
      // No network, no permission, a broken feed: all the same. The class
      // never finds out.
      log(`no se pudo comprobar la actualización: ${messageOf(error)}`)
      return 'failed'
    }
  }

  /**
   * Installs what was downloaded. Called when the application is already on
   * its way out, which is the only moment at which replacing the running
   * program cannot interrupt anything.
   *
   * A running AppImage is a file the kernel has already mapped: renaming a
   * new one over it replaces the next launch and leaves this one alone.
   */
  applyOnQuit(): boolean {
    const pending = this.pending
    const target = this.deps.appImagePath
    if (!pending || !target) return false
    this.pending = null
    try {
      chmodSync(pending.file, 0o755)
      replaceFile(pending.file, target)
      this.deps.log(`instalada la versión ${pending.version}`)
      return true
    } catch (error) {
      // The download stays behind on a failure only to be cleaned up: half an
      // application on disk is worse than the version that already works.
      this.deps.log(`no se pudo instalar la versión ${pending.version}: ${messageOf(error)}`)
      try {
        rmSync(pending.file, { force: true })
      } catch {
        // Nothing left to do about it.
      }
      return false
    }
  }
}

/**
 * Puts `source` where `target` is, atomically.
 *
 * A rename is atomic but only inside one filesystem, and the download
 * directory and the AppImage are very often on different ones. The copy goes
 * next to the target and only then takes its place: an interrupted copy
 * leaves the version that works untouched.
 */
function replaceFile(source: string, target: string): void {
  try {
    renameSync(source, target)
    return
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error
  }
  const beside = `${target}.new`
  copyFileSync(source, beside)
  chmodSync(beside, 0o755)
  renameSync(beside, target)
  rmSync(source, { force: true })
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
