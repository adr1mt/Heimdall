# Verificación local de Heimdall 1.0.1

2026-10-22. Linux x64. Preparación local: **sin push, etiqueta ni publicación**.
Base de código 617b9e6, más los cambios de versión de T197 y actualización del
arnés de entrega a permisos 0600. El último commit de preparación registra
exactamente estos cambios y este informe.

## Paquetes

Construcción: Go **1.26.10**, Electron **43.8.3** (Node **24.22.0**),
electron-builder 26.18.0. `make version` con Go 1.26.10 y
`npm run dist -- --publish never`. AppImage ~139 MiB y .deb ~117 MiB.
Versiones de motor, aplicación, lock y metadatos .deb coinciden en **1.0.1**.
Las sumas exactas están en [SHA256SUMS](SHA256SUMS).

- AppImage extraído: AppRun probado con y sin user namespaces y opción
  explícita. Renderer y preload reales correctos en modo automático, sandbox
  y fallback, con perfiles ficticios nuevos.
- `make gui-paquete`: motor incluido ejecutable, misma corrección del
  laboratorio sin entorno de desarrollo ni PATH y arranque sin motor externo.
- `.deb` instalado y retirado realmente en contenedores Ubuntu **24.04 y
  26.04**. Motor incluido y versión comprobados; no instalado en el host.
- `.AppImage` conserva el fallback de compatibilidad; ejecutar sin sandbox
  reduce el aislamiento y no equivale al modo protegido.

## Pruebas y seguridad

- **573 pruebas GUI**, tipos y build/preload correctos. Dos regresiones prueban
  descarga 1.0.1 desde el primer y segundo paquete 1.0.0, sin reemplazo hasta
  cerrar. La versión igual sigue sin descargarse.
- Diez pruebas de herramientas; la comprobación de versión falla de verdad
  si cualquiera de las dos versiones del lock difiere.
- `go test ./...` y `go test -race ./...` con **Go 1.26.10** correctos.
- govulncheck 1.9.0 con Go 1.26.10: **cero vulnerabilidades alcanzables y cero
  avisos en paquetes importados**. Un aviso a nivel de módulo en openpgp de
  x/crypto, que Heimdall no importa (GO-2026-5932).
- npm audit: ocho moderados, exclusivamente cadena de construcción; excepción
  precisa GHSA-hp3w-g68c-fv3c y barrera frente a avisos nuevos o de producción.
- Integración completa anterior a la preparación de versión: SSH, secretos,
  cancelación, eventos, tubería llena, sesión, RA2 y carga de 100 ficticios
  correctos. Pruebas sudo con contraseña incorrecta y máquina sin sudo reales.
- Entrega GUI → motor 1.0.1 → tres máquinas ficticias: permisos **0600**, dueño
  alumno, solo informe propio, sin secreto en argv, sin temporales restantes.
  Máquina apagada y segunda entrega con otra máquina apagada comprobadas;
  0,20 s y 4,58 s respectivamente. Sin errores de consola.
- Recuperación de fuentes con renderer/IPC reales, cancelación, original
  corrupto conservado y examen como borrador: [T200](../../reviews/evidence/T200/RESULTADOS.md).
- Transporte Chromium probado con respuesta Brotli real y Node fetch bloqueado:
  [T201](../../reviews/evidence/T201/RESULTADOS.md).

## Pendientes explícitos

Los workflows nuevos aún **no se han ejecutado en GitHub**. La corrección
completa de una clase real sigue en **T084**, pendiente de T070; ningún alumno
ficticio sustituye esa validación. Electron conserva Node sin el parche del
21-oct; está mitigada la ruta de red del actualizador, no parcheado el runtime.

Firmas de procedencia, registro SSH previo y división de Resultados siguen
siendo mejoras posteriores. Las pruebas no demuestran ausencia de todos los
fallos ni simulan un corte eléctrico. No se reutilizan publicaciones previas.
