# T187 — Avisos de éxito y cierre automático

2026-10-22. Reparación solicitada por Adrià: «Clase guardada» permanecía hasta
pulsar la X. La barra no tenía temporizador y trataba todas las notificaciones
como errores.

## Resultado

- Confirmaciones de clases, exportaciones y restauraciones sin problemas:
  verde, icono de comprobación, `role=status` y cierre automático a los 5 s.
- Cancelación de exportaciones: información neutra y cierre automático.
- Errores y restauraciones con problemas: rojo, alerta y cierre manual.
- Cada mensaje reinicia el plazo, también al repetir el texto. Sustituirlo por
  un error o cerrarlo cancela el temporizador anterior.

## Comprobaciones

- Regresión antes de implementar: 5 pruebas fallan; «Clase guardada» no caduca.
- `make check`: correcto.
- `make gui-check`: tipos y 579 pruebas correctos.
- `make gui-build`: correcto, incluido preload.
- `git diff --check`, documentación y herramientas: correctos.
- [Arnés](../../../../gui/scripts/notices-lab.ts) con renderer, preload e IPC
  reales; perfil temporal y clase ficticia. Guarda la clase, comprueba
  color/icono/rol, espera el cierre sin pulsar X e introduce un error controlado
  por el canal de avisos. El error sobrevive al temporizador anterior y a
  cambiar de pantalla; la X sigue cerrándolo.
- Capturas revisadas: [éxito claro](success-light.png),
  [éxito oscuro](success-dark.png), [sin aviso](dismissed-light.png),
  [error claro](error-light.png) y [error oscuro](error-dark.png).

Ejecución del arnés desde `gui/`, después del build:

```bash
node_modules/.bin/esbuild scripts/notices-lab.ts --bundle --platform=node --format=esm --outfile=/tmp/heimdall-notices-lab.mjs --external:electron
node_modules/electron/dist/electron /tmp/heimdall-notices-lab.mjs --no-sandbox
```

## Límites

El aislamiento del ejecutor bloquea subprocesos Node (`EPERM`/`ETIMEDOUT`) y
el arranque Chromium. La suite y el arnés pasan fuera de ese aislamiento sin
modificar pruebas ni ampliar plazos. El arnés usa `--no-sandbox`; no valida
el sandbox de distribución. El primer intento visual usó una clase ficticia
incompleta y no pudo guardar; se corrigió la fixture, sin cambiar la validación
de clases. No se modifica la versión instalada ni se publica una actualización.
