# Reparación de la auditoría del 02-10-2026

**Estado: resueltas las 18 incidencias (9 prioritarias, 8 medias y 1 menor).**
T127–T144 están DONE con sus criterios y pruebas. Se mantienen el informe
original y sus reproducciones como evidencia del estado previo, commit a48e555.
La reparación se ha dividido en commits locales por incidencia, con regresiones.

No se han publicado notas ni una release, ni usado alumnos reales. Se han
reconstruido el motor, AppImage y .deb locales; el número sigue siendo 0.9.0.

## Cambios y evidencia por incidencia

| Incidencia / tarea | Resultado y regresión |
|---|---|
| A01 / T127 | Un prefijo recortado solo permite resultados demostrados por él: coincidencias de contiene/cerca_de y texto prohibido de no_contiene. Ausencia o igualdad sin evidencia completa quedan UNEVALUATED / OUTPUT_OVERFLOW. Tests puros y salida SSH real antes/después de 64 KiB. |
| A02 / T128 | no_contiene exige exit 0 para aprobar. Comando inexistente, cat fallido y otros códigos no demuestran ausencia. Tests de aserción y reproducción SSH; exit_code sigue admitiendo códigos no nulos exigidos explícitamente. |
| A03 / T129 | Supervisor remoto fijo con nonce distingue 124/137 propios del timeout y SIGKILL. Recibir TERM impide publicar terminación normal, incluso si el manejador del comando devuelve 124. Registro ausente o contradictorio produce ejecución incompleta sin exit_code. Regresiones rojas demostradas y después verdes. |
| A04 / T130 | Cancelar cierra el transporte durante TCP, handshake, autenticación, apertura, envío y lectura. Servidores SSH de prueba bloquean handshake, autenticación, apertura y Start: se liberan dentro del límite, con -race. |
| A05 / T131 | Se conservan las últimas 50 correcciones por started_at canónico, sin ordenar por nombre aleatorio. Regresiones de 51/100 correcciones en varias pasadas, restauración y fechas que contradicen el nombre. |
| A06 / T132 | Se valida y guarda exactamente el borrador visible. YAML inválido se conserva, impide guardar y volver al formulario, y salir ofrece conservar o descartar. Aceptación Electron: guardado exacto con comentarios, fichero roto, navegación y ausencia de escritura de una versión anterior. |
| A07 / T133 | Antes de representar el YAML se rechazan claves/tipos que el formulario no puede conservar, cmd+valor y varias aserciones. Se mantiene el texto original. Regresiones en editor.test.ts. |
| A08 / T134 | Mejor vuelta por peso obtenido sin redondear; empate real conserva la primera. FINISHED exige todos los pesos positivos en PASS. Regresión 249/250 seguida de 250/250 y FAIL de peso diminuto. |
| A09 / T135 | Pesos decimales, notación exponencial y cero se conservan. Un número a medio escribir permanece editable sin abandonar el formulario. Round-trip y validación con motor, más aceptación Electron A09-1/2. |
| A10 / T136 | Un fichero de clases con una fila, campo o id corruptos se rechaza antes de guardar. Se indica ubicación y no se reemplaza por una versión parcial. Tests de lectura/escritura sobre fichero real. |
| A11 / T137 | NaN, infinito y suma desbordada son errores de PLAN. Cualquier peso positivo pendiente impide nota final; los porcentajes evitan desbordar productos intermedios. Tests con 1e-10, 1e-100, 1e-300 y 1e308. |
| A12 / T138 | Redacción defensiva cubre metadata textual, nombres, usuario/dirección, descripciones, fuentes, avisos y procedencia textual; valores largos primero. Conserva ids, enums y digests estructurales para reintento/consolidación. Tests de metadata y aceptación de secretos. |
| A13 / T139 | Lectores Go/GUI validan campos obligatorios, ids, pesos, PLAN, estados, evidencia de resultados académicos y coherencia de notas. EXCLUDED y RESTORED_FROM_BACKUP son excepciones explícitas. Corrupciones rechazadas y copias legítimas aceptadas. |
| A14 / T140 | Cancelación local publica UNKNOWN; cerrar SSH no prueba muerte remota. CANCELLED prevalece sobre las causas de limpieza. Regresión real de cancelación y tests de prioridad; timeout remoto confirmado mantiene KILLED_REMOTE. |
| A15 / T141 | Copias automáticas asíncronas y serializadas por examen, con cabeceras acotadas y como máximo 50 artefactos completos. Los fallos llegan a un aviso; cerrar espera las copias pendientes. Tests de destino inaccesible, pasadas concurrentes e IPC; recuperación real desde la GUI. |
| A16 / T142 | Texto lateral y botones destructivos normal/hover alcanzan 4,5:1 en ambos temas. Regresión de contraste y revisión Electron a 1280×820 y 960×640. Sin rediseño. |
| A17 / T143 | Activar corrección/modo examen cancela feed/descarga y vuelve a comprobar ocupación antes y después. Peticiones concurrentes comparten una comprobación. Feed 15 s; descarga 180 s / 1 GiB de bytes reales, con borrado de parciales. Tests de carreras, tamaño, cancelación y plazo. |
| A18 / T144 | Error de arranque y close finalizan la sesión una sola vez, con un único callback y limpieza. Regresiones ENOENT, EACCES y cierre normal. |

Regresiones principales en `internal/{assert,model,plan,report,ssh,engine}`,
`cmd/heimdall` y `gui/tests`. La aceptación del editor está en
`gui/scripts/editor-lab.ts`, y las capturas en `gui/scripts/audit-ui.ts`.
No se ha añadido ninguna dependencia para resolver las incidencias.

## Verificación final

- Motor: **193 tests** con `go test -race -json -tags=integration ./...`.
- GUI: **410 tests en 29 ficheros**, más typecheck de main, renderer y tests.
- `make test`: vet, suites pura e integrada, versión, secretos, aceptación,
  eventos, sesión, RA2 y carga de **100 alumnos**. Clase completa evaluada.
- `npm run --silent editor-lab` (aceptación gui-editor): D-1…D-7,
  A06-1…A06-7 y A09-1/2 verdes con Electron,
  perfil temporal, preload sandboxed y una corrección SSH real.
- `make gui-lab`: secretos fuera de argv/entorno/ficheros, histórico, CSV,
  copia automática y recuperación tras borrar var/ verdes.
- `make gui-dist` y `make gui-paquete`: AppImage/.deb reconstruidos, motor
  embebido que corrige sin entorno ni dependencias, aplicación con perfil limpio.
- Preload sandboxed: CommonJS único y ruta comprobados por verify:preload.
- Contraste AA de los estados auditados en ambos temas; capturas revisadas.
  El detector Impeccable solo señala la fuente Inter preexistente: fuera del
  alcance de esta reparación y conservada para no rediseñar la aplicación.

Logs completos en [evidence/repair](evidence/repair/). Las capturas documentan
contraste y disposición; el texto del aviso del YAML se aclaró después, sin
cambiar esos estilos. Las regresiones posteriores de timeout están incluidas
en las suites finales, y el paquete se reconstruyó después de ellas.

## Decisiones y límites

[ADR-0024](../../adr/0024-evidencia-de-terminacion-remota.md) documenta la
excepción acotada del supervisor remoto. [ADR-0025](../../adr/0025-integridad-en-los-limites-de-evidencia-y-peso.md)
documenta evidencia suficiente, números finitos, pendientes positivos y elección
sin redondear. Arquitectura, guía, modos de fallo y memoria del proyecto actualizados.

- La lectura de artefactos detecta corrupción y omisiones; no aporta autenticidad
  criptográfica ni recalcula la nota sobre una máquina actual.
- La copia recuperada conserva notas y comprobaciones; no conserva comandos y
  salidas de las máquinas. La pantalla publica esta limitación.
- Los tests Electron usan --no-sandbox como los arneses del repositorio; no son
  una certificación del aislamiento de sistema de producción.
- La aceptación del paquete usa `dist/linux-unpacked` de esta reconstrucción.
  No se instalaron el .deb ni una actualización real desde una release; tampoco
  se probaron apagón físico, disco lleno real, lector de pantalla ni artefactos
  de tamaño máximo. El destino inaccesible de copia sí está reproducido.
- **T084 sigue pendiente:** examen real de aula completo con los exámenes del
  curso (T070). Autenticación por clave SSH sigue en T023. Estos límites no
  forman parte de las 18 incidencias reparadas.
