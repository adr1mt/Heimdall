# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-10-02 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**T156 · Lectura acotada de artefactos.**

- Motor y GUI aplican los 64 MiB sobre los bytes realmente leídos.
  Un fichero que crece después de consultar su tamaño también se rechaza.
- Lector Go compartido por reintento, consolidación y sesión; conserva
  validación de campos obligatorios y coherencia antes de utilizar notas.
- Apertura, histórico y copias GUI usan el mismo módulo de lectura.
  La restauración escribe el mismo texto que validó, sin releer el fichero.
- Sin cambios de nota, formatos, ADR, retención ni reglas de composición.
- `make check`, `make build`, tipos y build GUI correctos; 433 tests GUI pasan.
  Se probaron límite exacto, exceso y crecimiento; las copias conservan
  su excepción sin evidencia y nunca sobrescriben originales.
- El aislamiento falló al resolver localhost y en dos tests de cierre.
  Los dos fallan también en HEAD anterior; fuera del aislamiento pasan todos.
- T157 (paridad de validadores) READY; T158 (recorrido de copias) depende de ella.
  Una tarea por sesión en esta zona crítica, conforme a CLAUDE.md.

**T127–T155 · Auditorías reparadas.**

- 18 incidencias iniciales y 11 posteriores reparadas, incluyendo cadenas
  completas, cierre, actualizaciones, presupuestos de evidencia y YAML.
- Evidencias: `docs/audits/2026-10-02/REPARACION.md` y
  `docs/audits/2026-10-02/post/repair/REPARACION.md`.
- AppImage/.deb 0.9.0 de la sesión anterior; no se reempaquetaron en T156.

## Problemas conocidos y límites

- Laboratorio en **127.1.2.3**. Arneses que cuentan conexiones o buscan
  secretos globalmente se ejecutan de forma secuencial.
- Reintentos: mismo PLAN y máximo 50 eslabones. Modo examen: mínimo 5 min.
- Hasta 2000 celdas y 1 MiB de metadatos resueltos;
  inventario hasta 65536 bytes. PLAN no admitido se rechaza antes de SSH.
- Evidencia recortada tras comparar, con aviso; copias conservan notas,
  comprobaciones y procedencia, no salidas.
- Cierre normal espera resultado y copia; cierre forzado puede interrumpirlo.
- Linux x64. Actualización automática solo AppImage; `.deb` mediante apt.
  No se ha instalado una actualización desde una release real.
- Editor formulario reformatea YAML; edición directa conserva texto.
  Autenticación por clave SSH pendiente (T023).

## Siguiente tarea recomendada

**T157**: corpus común para comprobar paridad de aceptación Go/GUI sin
cambiar la autoridad de la nota. **T070** sigue desbloqueando **T084**,
examen real de aula de principio a fin que ejecuta Adrià antes de la 1.0.0.
