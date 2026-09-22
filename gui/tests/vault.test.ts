import { describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  forgetPassword,
  rememberPassword,
  rememberedPassword,
  vaultFile,
  type Cipher
} from '../src/main/vault'
import { t } from '../src/renderer/src/i18n/es'

function emptyDir(): string {
  return mkdtempSync(join(tmpdir(), 'heimdall-vault-'))
}

/** A stand-in for safeStorage: reversible, and never the plain text. */
const working: Cipher = {
  available: () => true,
  encrypt: (plain) => Buffer.from(plain, 'utf-8').reverse(),
  decrypt: (sealed) => Buffer.from(sealed).reverse().toString('utf-8')
}

const none: Cipher = {
  available: () => false,
  encrypt: () => {
    throw new Error('no debería cifrar')
  },
  decrypt: () => {
    throw new Error('no debería descifrar')
  }
}

describe('la contraseña del aula', () => {
  it('se recupera igual que se escribió', () => {
    const dir = emptyDir()
    expect(rememberPassword(dir, working, 'usuario')).toBe(true)
    expect(rememberedPassword(dir, working)).toBe('usuario')
  })

  it('no queda en claro en el fichero', () => {
    const dir = emptyDir()
    rememberPassword(dir, working, 'contraseña-del-aula')
    expect(readFileSync(vaultFile(dir), 'utf-8')).not.toContain('contraseña-del-aula')
  })

  it('no guarda nada cuando el sistema no ofrece cifrado', () => {
    const dir = emptyDir()
    expect(rememberPassword(dir, none, 'usuario')).toBe(false)
    expect(existsSync(vaultFile(dir))).toBe(false)
    expect(rememberedPassword(dir, none)).toBe('')
  })

  it('no recuerda nada cuando no hay nada guardado', () => {
    expect(rememberedPassword(emptyDir(), working)).toBe('')
  })

  it('olvida el fichero, no su contenido', () => {
    const dir = emptyDir()
    rememberPassword(dir, working, 'usuario')
    forgetPassword(dir)
    expect(existsSync(vaultFile(dir))).toBe(false)
    expect(rememberedPassword(dir, working)).toBe('')
  })

  it('olvidarla dos veces no es un error', () => {
    const dir = emptyDir()
    forgetPassword(dir)
    forgetPassword(dir)
    expect(existsSync(vaultFile(dir))).toBe(false)
  })

  it('una contraseña vacía olvida la guardada', () => {
    const dir = emptyDir()
    rememberPassword(dir, working, 'usuario')
    expect(rememberPassword(dir, working, '')).toBe(false)
    expect(existsSync(vaultFile(dir))).toBe(false)
  })

  it('un fichero que no se puede descifrar no devuelve una contraseña', () => {
    const dir = emptyDir()
    rememberPassword(dir, working, 'usuario')
    const broken: Cipher = {
      available: () => true,
      encrypt: working.encrypt,
      decrypt: () => {
        throw new Error('otra sesión')
      }
    }
    expect(rememberedPassword(dir, broken)).toBe('')
  })

  it('el texto que la pide no nombra ninguna referencia', () => {
    const texts = [
      t.credentials.title,
      t.credentials.hint,
      t.credentials.label,
      t.credentials.placeholder,
      t.settings.passwordHint
    ]
    for (const text of texts) {
      expect(text).not.toMatch(/\$\{|[A-Z]{3,}_[A-Z]/)
      expect(text.toLowerCase()).not.toContain('referencia')
    }
    expect(t.credentials.hint).toContain('máquinas del aula')
  })
})
