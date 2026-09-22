import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * What the system offers to encrypt with. It is a parameter and not an import
 * of electron so the guarantee this module exists for —that nothing readable
 * is written— can be tested without a desktop session.
 */
export interface Cipher {
  available: () => boolean
  encrypt: (plain: string) => Buffer
  decrypt: (sealed: Buffer) => string
}

/**
 * The classroom password, on its own. It never shares a file with the
 * settings or with the classes: those two are read as plain text by anyone
 * looking at the data directory, and this one is not (ADR-0023).
 */
export function vaultFile(dir: string): string {
  return join(dir, 'aula-password.enc')
}

/**
 * Remembers the password, or forgets it if it is empty. Answers whether it
 * was kept: a system without encryption keeps nothing, and the screen has to
 * know, because there the teacher goes on typing it every time (ADR-0023 §3).
 */
export function rememberPassword(dir: string, cipher: Cipher, password: string): boolean {
  if (!password) {
    forgetPassword(dir)
    return false
  }
  if (!cipher.available()) return false
  try {
    const sealed = cipher.encrypt(password)
    mkdirSync(dirname(vaultFile(dir)), { recursive: true })
    const tmp = `${vaultFile(dir)}.tmp`
    writeFileSync(tmp, sealed, { mode: 0o600 })
    renameSync(tmp, vaultFile(dir))
    return true
  } catch {
    // Not being able to keep it is not a failure of the correction: the
    // teacher types it, as before.
    return false
  }
}

/**
 * The password remembered, or nothing. A file that cannot be deciphered —a
 * different user, a reinstalled system— is nothing too: a wrong password
 * would fail on every machine of the class at once.
 */
export function rememberedPassword(dir: string, cipher: Cipher): string {
  if (!cipher.available()) return ''
  try {
    return cipher.decrypt(readFileSync(vaultFile(dir)))
  } catch {
    return ''
  }
}

/** Forgets it: the file goes, not its contents blanked. */
export function forgetPassword(dir: string): void {
  rmSync(vaultFile(dir), { force: true })
}
