# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.
**Actualizado**: 2026-10-22 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**Auditoría 2026-10-22, autorizada por Adrià:** T194–T201 desglosadas.
**T194:** una nota final ya no se presenta incompleta por diagnósticos de peso
cero pendientes; se conserva su incidencia técnica. Regresión antes/después,
tipos, suite GUI y build/preload correctos. **T195:** datos de clases privados
(0700/0600), incluidas instalaciones existentes y temporales antiguos; JSON
corrupto intacto y enlaces rechazados. 562 pruebas GUI y controles correctos.
**T196:** informes 0600 con dueño SSH, probado contra el laboratorio real;
enlaces y directorios conservan la protección (ADR-0033). Siguiente:
validación de publicación y copias de clases/exámenes. **T199:** sudo probado
con contraseña incorrecta real, usuario sin privilegios y máquina sin sudo;
no se ejecuta el comando ni se convierte el rechazo en suspenso. **T201:**
red del actualizador por Chromium; arnés Brotli real y paquete con/sin sandbox
correctos. 563 pruebas GUI. [Evidencia](../reviews/evidence/T201/RESULTADOS.md).
**T198:** barreras race/Go/npm y workflow manual de publicación preparados;
integración completa, 100 ficticios y .deb instalado/retirado en Ubuntu 24/26
correctos. [Evidencia y límites](../reviews/evidence/T198/RESULTADOS.md).
GitHub aún no ha ejecutado estos cambios; aula real sigue en T084.

**T189 · Comprobaciones con `sudo: true` (ADR-0032).** Kea 3 en Ubuntu 26.04
deja `/etc/kea` solo a root. Antes los exámenes de 0227 llevaban la contraseña
dentro de un `bash -c`; ahora basta `sudo: true` y el motor usa la contraseña
de la clase por stdin. Si sudo no la acepta: sin evaluar (`AUTH_FAILED`), nunca
suspenso. Laboratorio con sudo y fichero solo de root. Exámenes de 0227
migrados; corrección real del servidor de Manuel Cadenas (2026-10-21):
prova-guia-kea 100/100, ra1-dhcp-kea 34/100, sin fallos por permisos.

**1.0.0 rehecha (2026-10-22).** AppImage sin FUSE probado en Ubuntu 24.04/26.04.

## Problemas conocidos y límites

- Si un consumidor no lee, puede faltar progreso y `run.end`; el resultado
  guardado mantiene la nota. La GUI trata un flujo sin cierre como incompleto.
- La copia sigue leyendo cada original para validar cambios y corrupción; el
  límite de 128 MB probado es del heap V8, no del RSS ni de cualquier examen.
- Laboratorio en 127.1.2.3; arneses SSH y secretos se ejecutan secuencialmente.
- Reintentos: mismo PLAN y máximo 50 eslabones. Modo examen: mínimo 5 min.
- Hasta 2000 celdas y 1 MiB de metadatos resueltos; inventario hasta
  65536 bytes. PLAN no admitido se rechaza antes de SSH.
- Copias conservan notas y procedencia, sin salidas. Recuperación no sobrescribe.
- Cierre normal espera resultado y copia; cierre forzado puede interrumpirlo.
- Linux x64. Actualización automática solo AppImage; .deb mediante apt. El
  .deb se probó extraído, sin instalarlo.
- Editor YAML conserva texto; Monaco se empaqueta en un chunk diferido local.
- Autenticación por clave SSH pendiente (T023), sin caso de uso aún.
- examen-lab.ts está desfasado desde T178 (T186); ui-refresh cubre el modo examen.
- La barra de avisos pinta en rojo también los guardados correctos (T187).
- Un resultado cuyo examen o clase cambió después no se puede enviar: se
  vuelve a corregir. Los motivos de conexión fallida son frases técnicas.
- Un informe que contenga el texto de la contraseña de la clase no se envía.
- Parches 2026-10-22: go1.26.10, vite 7.3.7, Electron 43.8.3 (Node 24.22.0, aún
  sin el parche del 21-oct). npm audit: 8 moderados de electron-builder, solo build.

## Siguiente trabajo

**T070**: rehacer exámenes del curso en formato nativo; desbloquea **T084**,
examen real de aula que ejecuta Adrià. Consultar `python3 scripts/tasks.py T070`
antes de empezar. **T023**, **T186** y **T187** siguen READY.
