# Reparación de la segunda auditoría · 2 de octubre de 2026

Las **11 incidencias R01–R11 están corregidas**, con regresiones y commits
locales separados. Se mantienen la arquitectura, las notas por resultado
inmutable, la selección del PLAN antes de SSH y las dependencias existentes.
La versión del producto continúa en 0.9.0; los paquetes locales se reconstruyen.

El informe [AUDITORIA.md](../AUDITORIA.md) conserva el diagnóstico histórico.
Las reparaciones se registran como T145–T155 en `docs/project/TASKS.json`.

| Incidencia | Comportamiento corregido y comprobación |
|---|---|
| R01 | La selección consulta toda la cadena y valida sus antecedentes antes de SSH. Tres reintentos reales conservan FAIL, solo ejecutan el pendiente y consolidan **50/100**. La cadena completa rechaza otro reintento. Se rechazan antecedentes ausentes, con otro PLAN o identidad incorrecta y un reintento que generaría más de 50 eslabones. La GUI cuenta pendientes sobre la vista consolidada. |
| R02 | El cierre detiene nuevas vueltas, cancela y espera el resultado final del motor y después la copia. Se comprueban motor activo, intervalo entre vueltas, copia en marcha y fallo del destino. El fallo se avisa antes de salir. Electron compilado y SSH real dejan original y copia; las notas se recuperan tras borrar los originales. |
| R03 | Una descarga vacía falla. La actualización requiere tamaño positivo y SHA-256 publicados, verifica los bytes antes de declararlos listos y vuelve a verificarlos antes de sustituir el programa. Vacío, HTML, tamaño/digest incorrectos y modificación posterior del fichero conservan la instalación anterior. Un contenido válido sí se instala sobre un destino temporal. |
| R04 | Se conservan 50 correcciones recientes y sus antecedentes completos, con máximo de 50 eslabones por cadena. Tres rotaciones con cadenas de 2 y 4 eslabones preservan las dependencias. Una recuperación real de 51 ficheros conserva el antecedente antiguo y `consolidate` funciona sin los originales. Una cadena incompleta produce un aviso y no se ofrece para recuperar. ADR-0026. |
| R05 | Presupuesto común con la GUI: hasta 2000 celdas y 1 MiB de configuración descriptiva resuelta, comprobados antes de SSH; evidencia guardada uniforme y acotada después de calcular las notas. El caso de 72.761.127 bytes ahora ocupa aproximadamente **6,4 MB**, sale con 0, conserva todas las notas, se abre y se copia. Ambos flujos al máximo, expansión JSON, UTF-8 y procedencia se prueban. La redacción precede al recorte, sin una serialización JSON gigante para copiar la evidencia. ADR-0027. |
| R06 | Un examen solo con pesos cero termina con exit 2 sin resultado. Una mezcla con peso positivo se ejecuta, conserva el diagnóstico cero y produce un resultado legible. |
| R07 | Los valores resueltos de inventario admiten hasta 65536 bytes, como SSH y los lectores. CLI real con ASCII y UTF-8: 65535/65536 bytes se ejecutan y se leen; 65537 bytes salen con 2 antes de escribir resultados. |
| R08 | Se seleccionan las 50 correcciones por fecha canónica, mediante cabeceras acotadas compartidas con copias. Con 51 fechas de fichero invertidas aparece R50, la última corrección real. Los errores de cabecera se muestran aparte y no desplazan correcciones válidas. |
| R09 | Una vuelta completa con todos los pesos positivos en PASS gana a una imperfecta aunque sus sumas float64 coincidan. Pesos 1 y 1e-100: termina el alumno y la procedencia es la segunda vuelta perfecta. Se conserva el primer empate entre vueltas perfectas. |
| R10 | Se decodifica un documento YAML y se exige EOF. Examen e inventario rechazan documentos adicionales válidos, desconocidos, vacíos y contenido malformado, con ubicación. Los comentarios finales se admiten. CLI real rechaza la ambigüedad sin resultados. |
| R11 | Cada clave del alumno se comprueba antes de asignar: id, nombre, moodle_id, exclusión, hosts y campos libres duplicados se rechazan con las dos líneas. CLI real rechaza un id repetido y no crea resultado. |

## Verificación

- `make check`: análisis estático y suite rápida correctos.
- `go test -race -count=1 ./...`: correcto.
- `go test -race -count=1 -tags=integration ./...`: correcto contra SSH local.
- Carreras adicionales en CLI e informes después de la revisión final: correctas.
- `make test` completo, secuencial: correcto; SSH, secretos, eventos, sesiones,
  examen RA2 y carga de 100 alumnos.
- Tipos main, renderer y tests: correctos. Vitest: **427 pruebas en 30 ficheros**.
- Compilación de GUI y verificación de preload CommonJS: correctas.
- Editor: criterios D-1…D-7, A06-1…A06-7 y A09-1/2 correctos.
- GUI: secretos S-0…S-4, histórico H-1, exportación X-1/2 y recuperación B-1…B-3
  correctos, ejecutados después del editor, sin concurrencia entre arneses.
- Paquetes AppImage y .deb locales reconstruidos. Aceptación del paquete P-1…P-3:
  motor incluido, misma corrección sin entorno de desarrollo y arranque limpio.

La primera ejecución de `make test` coincidió con otros arneses SSH y falló
S-3 de sesiones: su contador global de conexiones observó tres conexiones
ajenas. Se conserva el log concurrente. Las repeticiones secuenciales completas
pasan; no se atribuye el fallo inicial al producto ni se elimina su evidencia.

## Repetir los diagnósticos

Desde la raíz del repositorio, con el motor compilado en `bin/heimdall`:

```bash
python3 docs/audits/2026-10-02/post/repair/evidence/retry-grade.py
python3 docs/audits/2026-10-02/post/repair/evidence/yaml-probe.py
python3 docs/audits/2026-10-02/post/repair/evidence/plan-boundaries.py
python3 docs/audits/2026-10-02/post/repair/evidence/large.py
gui/node_modules/.bin/esbuild docs/audits/2026-10-02/post/repair/evidence/large-check.ts --bundle --platform=node --format=esm --outfile=/tmp/heimdall-large-check.mjs
node /tmp/heimdall-large-check.mjs
gui/node_modules/.bin/esbuild docs/audits/2026-10-02/post/repair/evidence/recovery.ts --bundle --platform=node --format=esm --outfile=/tmp/heimdall-recovery.mjs
node /tmp/heimdall-recovery.mjs
gui/node_modules/electron/dist/electron docs/audits/2026-10-02/post/repair/evidence/close.cjs nuevo-perfil --no-sandbox
```

Los programas usan datos ficticios y `/tmp/heimdall-repair`. El reintento crea
y elimina un único fichero temporal en el contenedor de laboratorio `alu1`,
`127.1.2.3:2201`. Ejecutar los arneses SSH secuencialmente cuando alguno compruebe
contadores globales. Los ficheros grandes y perfiles temporales no se versionan.
El cierre debe comprobarse desde otro proceso después de que Electron salga:
`project/var/run-*.json` y `profile/copias/*/run-*.json` deben existir.

Las pruebas de actualización usan HTTP simulado y destinos temporales; no hay
una release real instalada. Los metadatos de integridad corresponden al
[contrato oficial de assets de GitHub](https://docs.github.com/en/rest/releases/assets).
Los paquetes no se han instalado en el equipo del profesor ni publicado.
La terminación forzada del sistema no garantiza la espera del cierre normal;
la prueba real de aula T084 sigue pendiente. Las pruebas Electron usan
`--no-sandbox`, como los arneses existentes.
