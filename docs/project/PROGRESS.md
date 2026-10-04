# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.
**Actualizado**: 2026-10-04 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**T167 · El progreso atascado ya no bloquea el motor ni la cancelación.**

- Base: 8853b90, árbol limpio. El arnés T166 documentó el fallo; la regresión
  nueva lo reprodujo antes del cambio: SIGINT no terminó en 10 s.
- Un único escritor entrega eventos con 256 líneas y 2 MiB en espera como
  máximo; el cierre espera hasta 500 ms. El resultado canónico se guarda sin
  depender del consumidor. La pérdida se avisa por stderr y, si se conoce antes
  del guardado final, también en el resultado (`PROGRESS_LOST`).
- `test/progress_pipe.py`: proceso real, tubería saturada sin leer ni drenar;
  cancelación exit 4 y terminación normal exit 0, ambas con resultado guardado.
  El caso normal conserva 100 notas finales de 100. Integrado en `make test`.
- Reproducción T166 repetida: ya no se bloquea; acabó antes de recibir SIGINT,
  por lo que la cancelación la acredita la regresión nueva. Caso voluminoso
  100×20: 16,46 s y 824056 KiB RSS; quedan T170/T171.
- `make check`, `go test -race ./...`, `make test` completo, `make gui-check
  gui-build` (525 pruebas), `make docs-check tools-check` correctos. La GUI
  pasó fuera del aislamiento por el fallo conocido `EAI_AGAIN localhost`.
- Contrato NDJSON y protecciones de secretos correctos. Sin cambios en notas,
  pesos ni estados. No se ha publicado ni hecho push.

**Contexto anterior:** T166 auditó la base 572d9eb; informe y arneses en
[T166](../reviews/T166-AUDITORIA.md). La distribución pública 0.9.1, AppImage,
.deb y actualización automática estaban verificadas en
[VERIFICACION](../releases/0.9.1/VERIFICACION.md). T160–T164 cerradas.

## Problemas conocidos y límites

- Si un consumidor no lee, puede faltar progreso y `run.end`; el resultado
  guardado mantiene la nota. La GUI trata un flujo sin cierre como incompleto.
- Siguen F2 (memoria de copias, T168), F3 (errores de lectura, T169) y F4
  (parciales/PLAN, T170/T171). No se encadenaron en esta sesión.
- El .deb se ejecutó extraído, sin instalarlo: sudo requiere contraseña.
- Laboratorio en 127.1.2.3; arneses SSH y secretos se ejecutan secuencialmente.
- Reintentos: mismo PLAN y máximo 50 eslabones. Modo examen: mínimo 5 min.
- Hasta 2000 celdas y 1 MiB de metadatos resueltos; inventario hasta
  65536 bytes. PLAN no admitido se rechaza antes de SSH.
- Copias conservan notas y procedencia, sin salidas. Recuperación no sobrescribe.
- Cierre normal espera resultado y copia; cierre forzado puede interrumpirlo.
- Linux x64. Actualización automática solo AppImage; .deb mediante apt.
- Editor formulario reformatea YAML; edición directa conserva texto.
  Autenticación por clave SSH pendiente (T023), sin caso de uso aún.

## Siguiente trabajo

**T168**: reducir memoria de copias. Partir de este commit limpio, leer criterios
con `python3 scripts/tasks.py T168` y reproducir F2 mediante
`docs/reviews/evidence/T166/reproduce_backup.ts`; comprobar la segunda pasada
de 50 resultados y restauración sin cambiar notas ni precedencias.
Después quedan T169, T170 y T171, cada una en sesión crítica separada.
**T070** sigue desbloqueando **T084**, examen real de aula que ejecuta Adrià.
