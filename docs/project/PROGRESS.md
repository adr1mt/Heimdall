# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.
**Actualizado**: 2026-10-22 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**La nota, lo primero en Resultados.** En «Matriz» la nota va arriba, grande
y rellena del color de aprobado/suspenso (ámbar si es provisional), fija bajo
los nombres al desplazar las comprobaciones. En «Lista», la misma insignia.

**T189 · Comprobaciones con `sudo: true` (ADR-0032).** Kea 3 en Ubuntu 26.04
deja `/etc/kea` solo a root. Antes los exámenes de 0227 llevaban la contraseña
dentro de un `bash -c`; ahora basta `sudo: true` y el motor usa la contraseña
de la clase por stdin. Si sudo no la acepta: sin evaluar (`AUTH_FAILED`), nunca
suspenso. Laboratorio con sudo y fichero solo de root. Exámenes de 0227
migrados; corrección real del servidor de Manuel Cadenas (2026-10-21):
prova-guia-kea 100/100, ra1-dhcp-kea 34/100, sin fallos por permisos.

**El actualizador en sesiones cortas**: comprueba a los 10 s y la descarga
solo se abandona parada un minuto
([evidencia](../reviews/evidence/actualizador-sesiones-cortas/RESULTADOS.md)).

**Versión 1.0.0 publicada** antes del examen real de aula (T084 pendiente).

**T188 · El informe se deja en la máquina de cada alumno (ADR-0031)**:
«Enviar informes…» en Resultados, con quién lo recibió y quién no
([evidencias](../reviews/evidence/T188/RESULTADOS.md)).

## Problemas conocidos y límites

- Si un consumidor no lee, puede faltar progreso y `run.end`; el resultado
  guardado mantiene la nota. La GUI trata un flujo sin cierre como incompleto.
- La copia sigue leyendo cada original para validar cambios y corrupción; el
  límite de 128 MB probado es del heap V8, no del RSS ni de cualquier examen.
- Laboratorio en 127.1.2.3; arneses SSH y secretos se ejecutan secuencialmente.
- Reintentos: mismo PLAN y máximo 50 eslabones. Modo examen: mínimo 5 min.
- sudo: un fallo de contraseña real no se prueba en el laboratorio (misma
  contraseña que la conexión); sí el usuario sin sudo y el fichero de root.
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
- Un informe que contenga el texto de la contraseña de la clase no se envía
  (p. ej. contraseña «alumno» y una descripción que dice «alumno»).
- Parches 2026-10-22: go1.26.10, vite 7.3.7, Electron 43.8.3 (Node 24.22.0, aún
  sin el parche del 21-oct). tailwindcss 3 arrastra `braces` (DoS solo en build).

## Siguiente trabajo

**T070**: rehacer exámenes del curso en formato nativo; desbloquea **T084**,
examen real de aula que ejecuta Adrià. Consultar
`python3 scripts/tasks.py T070` antes de empezar. **T023**, **T186** y
**T187** siguen READY.
