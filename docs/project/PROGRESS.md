# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-10-02 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**T145–T155 · Reparación de las 11 incidencias de la segunda auditoría.**

- R01: reintentos sobre la cadena completa, sin repetir PASS/FAIL anteriores;
  tres reintentos SSH reales mantienen 50/100 y la cadena completa no se repite.
  Se comprueban antecedentes y límite de 50 eslabones antes de SSH.
- R02: el cierre espera motor, resultado y copia; fallo de copia avisado antes
  de salir. Electron+SSH y recuperación sin originales comprobados.
- R03: actualización exige tamaño/digest y verifica SHA-256 antes de ready
  e instalación; descarga vacía rechazada.
- R04: 50 correcciones recientes y sus antecedentes completos; ADR-0026.
- R05: 64 MiB compartidos, admisión antes de SSH y evidencia acotada después
  de comparar, sin modificar notas; copia sin JSON previo gigante. ADR-0027.
- R06/R07: peso total positivo y valores resueltos hasta 65536 bytes.
- R08/R09: histórico por fecha canónica y vuelta perfecta reconocida aunque
  un peso muy pequeño desaparezca de la suma.
- R10/R11: un solo documento YAML y claves del alumno sin duplicados.
- Motor, SSH con carreras, aceptación completa secuencial y 427 tests GUI,
  tipos, build, editor, secretos y recuperación correctos.
- Paquetes AppImage/.deb reconstruidos, aceptación del paquete correcta.
  Versión 0.9.0; cambios y evidencias en commits locales.
- Informe: `docs/audits/2026-10-02/post/repair/REPARACION.md`.

**T127–T144**: las 18 incidencias de la primera auditoría también reparadas;
`docs/audits/2026-10-02/REPARACION.md` conserva su evidencia.

## Problemas conocidos y límites

- Laboratorio en **127.1.2.3**. Arneses que cuentan conexiones o buscan
  secretos globalmente se ejecutan de forma secuencial.
- Un reintento exige el mismo PLAN y máximo 50 eslabones recuperables.
  Intervalo mínimo del modo examen: 5 min.
- Hasta 2000 celdas (alumnos × checks) y 1 MiB de metadatos resueltos;
  valores de inventario hasta 65536 bytes. Se rechaza lo no admitido antes de SSH.
- La evidencia guardada se acota tras comparar y se avisa si se recorta;
  la copia conserva notas y comprobaciones, no las salidas.
- Cierre normal espera resultado y copia; cierre forzado puede interrumpirlo.
- Linux x64. Actualización automática solo AppImage; `.deb` mediante apt.
  No se ha instalado una actualización desde una release real.
- El formulario del editor reformatea YAML y comentarios; guardar YAML
  directamente conserva su texto. Autenticación por clave SSH pendiente (T023).

## Siguiente tarea recomendada

**T070** (exámenes del curso en formato nativo) desbloquea **T084**:
examen real de aula de principio a fin, que ejecuta Adrià antes de la 1.0.0.
