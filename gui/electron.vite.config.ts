import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * La CSP de producción, incrustada en el HTML al compilar.
 *
 * En la app instalada el renderer se carga con `loadFile` (`file://`), y el
 * `webRequest.onHeadersReceived` del proceso main NO interviene en ese esquema:
 * la cabecera que se envía en desarrollo no llegaba nunca a la versión
 * empaquetada, que es justo la que usa el profesor. Como `<meta>` sí se aplica.
 *
 * Solo en `build`: en desarrollo hace falta relajar `script-src` con
 * 'unsafe-inline' para el preámbulo de @vitejs/plugin-react, y eso lo resuelve
 * la cabecera de main.
 *
 * `base-uri` y `form-action` se declaran aparte porque NO heredan de
 * `default-src`: sin ellas, un `<base>` inyectado o un formulario podrían
 * redirigir o sacar las notas de los alumnos.
 */
const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self' blob:",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'"
].join('; ')

function inlineCsp(): Plugin {
  return {
    name: 'heimdall-inline-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${PRODUCTION_CSP}" />`
      )
    }
  }
}

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') }
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
        // Los preload ESM solo funcionan sin sandbox. Mantenemos el renderer
        // aislado y emitimos un único CommonJS explícito para Electron.
        output: { format: 'cjs', entryFileNames: '[name].cjs' }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src'),
        '@shared': resolve(__dirname, 'src/shared')
      }
    },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') }
      }
    },
    plugins: [react(), inlineCsp()]
  }
})
