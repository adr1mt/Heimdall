# T166 · Auditoría de simplicidad, robustez, fiabilidad y rendimiento

Fecha: 2026-10-04. Resultado: **base sólida, con cuatro áreas de mejora
confirmadas; no hace falta una reescritura**. No se modificó el producto.

## Alcance y estado revisado

- Base y HEAD: `572d9ebb07d564f7399b1cc5d94d44911f6c1fc3`.
- Revisión del estado completo, no de un intervalo de cambios. Árbol del
  producto limpio al comenzar; todos los hallazgos son preexistentes.
- Motor: PLAN, nota, validación, SSH, límites, concurrencia, eventos,
  cancelación, reintentos, sesiones y persistencia.
- Aplicación: arranque/cierre, ejecución, clases, histórico, copias,
  credenciales, editor, exportación, actualización y estado entre pantallas.
- Criterios: principios de CLAUDE, reglas de calidad/seguridad/arquitectura y
  ADR-0007, 0020, 0021, 0023, 0026 y 0027 según el área.
- Los únicos cambios locales de esta sesión son este informe, sus arneses y
  registros de evidencia, TASKS y PROGRESS. No se revisan como cambios del
  producto. `review.includes_uncommitted=false` describe el código auditado.

## Dictamen para el producto

La separación entre aplicación y motor está bien elegida. Las decisiones de
nota viven en el motor y los errores técnicos no se convierten en suspensos.
El formato declarativo, el único resultado canónico y los límites SSH reducen
la cantidad de estados que hay que mantener. Conviene conservarlos.

La prueba SSH de 100 alumnos terminó en **3 segundos**, sin comprobaciones
pendientes ni reintentos con el tope por máquina. Es una prueba corta contra
un laboratorio local; no predice cuánto dura un examen real ni una red de aula.
Los problemas de rendimiento encontrados están en el procesamiento local de
resultados voluminosos y acumulados, no justifican subir la concurrencia SSH.

Prioridad: desbloquear el canal de progreso; reducir la memoria de las copias;
hacer visibles los errores de lectura; reducir trabajo repetido de PLAN y
parciales. Son cambios internos que no necesitan más opciones ni pantallas.

## Hallazgos confirmados

### F1 · P1 · El progreso puede bloquear el motor y su cancelación — T167

**Disparador:** un consumidor mantiene abierto stdout pero deja de leer los
eventos. Puede ocurrir en una integración bloqueada; en la aplicación, las
operaciones largas del proceso principal pueden provocar contrapresión.

[Emitter.emit](../../internal/events/events.go) (líneas 243–252) escribe de
forma síncrona bajo un mutex. El [lanzador](../../cmd/heimdall/run.go) lo conecta
directamente al inicio y a los trabajadores. No hay plazo ni interrupción por
contexto para esa escritura. Todos los trabajadores que publican esperan al
mismo canal, aunque sus comandos SSH sí tengan timeout.

**Reproducción:** 100 alumnos ficticios × 20 comprobaciones de inventario;
stdout conectado a una tubería sin consumir. Tras enviar SIGINT, el proceso
seguía vivo tres segundos después. Al empezar a drenar la tubería terminó con
exit 4 y publicó el resultado. No intervino la red.
[Evidencia](evidence/T166/engine-probes.log) y
[arnés](evidence/T166/reproduce_engine.py).

**Impacto:** una avería en el canal informativo impide terminar la corrección,
guardar el resultado final y completar el cierre normal. La espera no queda
acotada por los presupuestos de SSH/alumno.

**Reparación mínima:** hacer que la entrega de eventos tenga recursos y espera
acotados, de modo que un consumidor detenido no impida guardar ni cancelar.
Si se pierde progreso, debe notificarse; el resultado canónico sigue siendo
la fuente de verdad. No basta con añadir una goroutine por evento ni una cola
sin límite. Probar un consumidor que nunca vuelve a leer.

### F2 · P1 · Las copias retienen la evidencia de muchos resultados — T168

[copyRuns](../../gui/src/main/backup.ts) (líneas 111–137) lee cada original
completo y lo conserva en `cache`, antes de comprobar si ya existe la copia.
Los textos de las máquinas permanecen en memoria aunque `gradesOnly` los
elimine al escribir. Se ejecuta automáticamente al terminar cada corrección,
dentro del proceso principal de Electron.

**Reproducción:** 50 resultados independientes generados por el motor, cada
uno de 30 alumnos × 20 comprobaciones, aproximadamente 6,36 MB por original.
La primera pasada guardó 50 copias; la segunda guardó cero.

| Pasada | Nuevas copias | Tiempo | Máximo RSS del proceso hasta ese punto |
|---|---:|---:|---:|
| Primera | 50 | 0,65 s | 513 MiB |
| Segunda | 0 | 0,45 s | 613 MiB |

En ambas quedó aproximadamente 324–326 MiB de heap ocupado al devolver el
resultado. El máximo RSS de la segunda fila es acumulado del mismo proceso;
no es una medida aislada de la segunda llamada. No se observó un cierre por
falta de memoria. Es consumo transitorio reproducible, no una fuga permanente
demostrada. [Evidencia](evidence/T166/backup-probes.log) y
[arnés](evidence/T166/reproduce_backup.ts).

**Impacto:** uso innecesario de cientos de MiB al cerrar cada corrección, que
crece con originales y antecedentes. Tener un límite de bytes por archivo no
acota el total retenido por la pasada.

**Reparación mínima:** validar cada original y descartar su evidencia antes de
retenerlo; conservar solo notas y relaciones necesarias para cadenas y
rotación. Mantener las comprobaciones de identidad, PLAN, precedencia del
original y protección de antecedentes. Evitar volver a cargar evidencia ya
respaldada sin introducir una base de datos ni otra fuente de verdad.

### F3 · P2 · Algunos errores de disco se muestran como ausencia de notas — T169

[listRuns](../../gui/src/main/history.ts) (líneas 35–38 y 45–54) convierte
cualquier fallo al listar la carpeta en una lista vacía y omite cualquier
fallo de `stat`. [runFilesIn/readBackupRuns](../../gui/src/main/backup.ts)
(líneas 61–66 y 244–249) también ocultan errores de acceso y copias corruptas.

**Reproducción:** crear resultados/copias válidos y retirar permiso de lectura
a sus carpetas devuelve `[]` en ambos listados. Corromper la única copia
produce también `[]`; restaurar responde «No hay ninguna copia de seguridad
de este examen», aunque el archivo existe.
[Evidencia](evidence/T166/backup-probes.log).

**Impacto:** el profesor puede creer que nunca hubo resultados o que ya no hay
copias, sin saber que debe reparar permisos o recuperar un archivo dañado.
La validación sí evita publicar notas corruptas: el defecto es ocultar la
causa. Durante una nueva pasada de copia sí se informan errores; eso no
corrige el listado al abrir una carpeta averiada.

**Reparación mínima:** tratar ENOENT como ausencia y comunicar los demás
fallos con ruta y motivo. Mostrar las copias válidas junto con los problemas;
no ofrecer una copia inválida como recuperable ni borrarla.

### F4 · P2 · El extremo admitido procesa demasiados datos — T170 y T171

Prueba sintética sin SSH: respuestas de inventario de 65536 bytes, dentro del
máximo actual, reutilizadas por 20 comprobaciones. Todas las notas finales
fueron correctas. El caso es exigente y no representa el uso medio.

| Alumnos × comprobaciones | Respuesta | Tiempo CLI | Máximo RSS | Resultado en disco |
|---|---:|---:|---:|---:|
| 30 × 20 | 32 bytes | 0,28 s | 19 MiB | 0,78 MB |
| 30 × 20 | 65536 bytes | 2,81 s | 234 MiB | 6,36 MB |
| 100 × 20 | 65536 bytes | 16,48 s | 791 MiB | 8,14 MB |

Hay dos causas que deben repararse por separado:

1. **T170, parciales:** [publish](../../internal/engine/engine.go) mantiene el
   mutex durante `WritePartial`. El escritor vuelve a redactar, recortar y
   serializar los alumnos ya terminados después de cada alumno. Un arnés
   aislado del mismo caso de 100 alumnos escribió **421394967 bytes** sumando
   100 parciales y el final. Ejecutar y guardar tardó 12,58 s; la variante
   diagnóstica que guardó solo el final tardó 0,23 s tras cargar el PLAN.
   Ambas dieron las mismas notas. **Eliminar los parciales no es la solución**:
   se perdería la protección ante muerte del proceso. La comparación aísla
   cuánto cuesta repetir ese trabajo. Reutilizar evidencia ya preparada y
   conservar la garantía de guardado es el primer camino a evaluar.
2. **T171, PLAN:** quitar los parciales no elimina el pico de memoria. Justo
   después de cargar el PLAN se midieron 541681472 bytes de heap asignado (sin forzar GC) y
   1084919080 bytes de asignaciones acumuladas. [hashPlan](../../internal/plan/resolve.go)
   (líneas 552–606) construye con `json.Marshal` una representación completa
   con la respuesta repetida por comprobación, aunque se excluya del presupuesto
   descriptivo. Esa representación del caso ocupa del orden de 125 MiB antes
   de buffers y copias. Acotar el materializado para calcular la huella,
   conservando exactamente su significado y compatibilidad, sin cambiar notas
   ni admitir resultados mayores. No se hizo un perfil de asignaciones por
   función: esa línea es una amplificación visible, no atribución de todo el RSS.

[Ejecución CLI](evidence/T166/engine-probes.log),
[comparación de parciales](evidence/T166/writer-probes.log),
[memoria tras PLAN](evidence/T166/plan-memory-probe.log) y
[arnés del escritor](evidence/T166/reproduce_writer.go).
Los tiempos son muestras de esta máquina, sin aislar el resto de su carga;
no son percentiles ni SLA.

## Simplicidad: qué conservar y qué evitar

- Conservar un motor, un resultado canónico y una GUI; no añadir servicios,
  colas externas, base de datos, cachés persistentes ni nuevas dependencias.
- Mantener distintas la consolidación de reintentos y la sesión de examen:
  responden a reglas de nota diferentes. Compartir solo lectura/validación
  y operaciones que ya sean realmente comunes.
- Reparar primero las rutas existentes. Las pantallas largas y varios bloques
  muy compactos dificultan leer el estado, pero su tamaño por sí solo no
  justifica dividirlas ni abrir una refactorización general.
- Conservar las protecciones actuales: acotación SSH, no reintentar comandos
  enviados, rechazo de notas incoherentes, copias sin sobrescribir originales,
  CSV defensivo y corpus común Go/TypeScript.
- Añadir regresiones de los fallos aquí reproducidos a las suites existentes.
  Un número alto de pruebas no sustituye esos escenarios de avería.

## Verificación realizada

Entorno: Linux x86_64, Go 1.27.1, Node 24.20.0; dependencias locales del proyecto.

- `GOCACHE=/tmp/heimdall-audit-go-cache make check`: correcto.
- `GOCACHE=/tmp/heimdall-audit-go-cache go test -race ./...`: correcto.
- `make gui-check gui-build`: tipos, **525 pruebas / 33 archivos**, compilación
  y verificación de preload correctos.
- `make lab lab-ra2`, después `GOCACHE=/tmp/heimdall-audit-go-cache make test`:
  suite SSH, secretos, aceptación, eventos, sesiones, RA2 y carga correctas.
  [Registro](evidence/T166/integration.log). A-10 es un criterio retirado,
  explícitamente marcado PEND por el arnés; no es una prueba que haya pasado.
- `make gui-lab gui-editor`: corrección real desde Electron, no exposición de
  secretos ficticios, histórico, CSV, copia/restauración y editor correctos.
  [Registro](evidence/T166/gui-lab.log).
- Se comprobó una sospecha del almacén de credenciales con Electron real y
  perfil temporal: `--password-store=basic` dio backend `basic_text` y
  `isEncryptionAvailable=false`. No se registra como vulnerabilidad.
- `make docs-check tools-check` y `git diff --check`: verificación de cierre.

La primera ejecución de Go no pudo escribir la caché del usuario: se usó una
caché temporal. Vitest dentro del sandbox falló con `EAI_AGAIN localhost`; las
mismas pruebas pasaron fuera. Los laboratorios y arneses se ejecutaron fuera
del aislamiento, secuencialmente entre sí y con alumnado/credenciales ficticios.

## Reproducción

Desde la raíz, con el motor compilado mediante `make build`:

```bash
python3 docs/reviews/evidence/T166/reproduce_engine.py
GOCACHE=/tmp/heimdall-audit-go-cache go build -o /tmp/heimdall-audit-writer docs/reviews/evidence/T166/reproduce_writer.go
# Usar temporary_work de la primera orden:
/tmp/heimdall-audit-writer /tmp/heimdall-audit-engine-XXXX/n100-s65536 full
/tmp/heimdall-audit-writer /tmp/heimdall-audit-engine-XXXX/n100-s65536 final
gui/node_modules/.bin/esbuild docs/reviews/evidence/T166/reproduce_backup.ts --bundle --platform=node --format=cjs --outfile=/tmp/heimdall-audit-backup.cjs
# Pasar un run-*.json final de n30-s65536/var:
node --expose-gc /tmp/heimdall-audit-backup.cjs /ruta/al/run-SINTETICO.json 50
```

Los arneses generan archivos exclusivamente temporales. No ejecutar la prueba
de permisos como root. La prueba completa puede consumir cerca de 1 GiB de
memoria y varios cientos de MB de espacio temporal. Las rutas de los registros
identifican las ejecuciones originales; los archivos grandes no se incorporan.

## Límites

No es una certificación exhaustiva ni una auditoría de vulnerabilidades de
dependencias. No se reinstaló el .deb, no se repitió la actualización pública,
no se cortó la alimentación y no se ejecutó un examen con alumnado real.
La prueba de modo examen de esta sesión cubre el motor y sus suites; no repite
las dos vueltas temporizadas de la AppImage documentadas en 0.9.1.

Los parciales conservan material tras una muerte forzada, pero el histórico
solo lista resultados finales y el lector ordinario exige un resultado cerrado:
no se ha certificado recuperación de parciales desde la GUI. Atomicidad del
rename y durabilidad ante pérdida de alimentación tampoco son lo mismo.
Estas son limitaciones, no pérdidas de notas observadas en las pruebas.

T070/T084 siguen siendo la comprobación pendiente con un examen real de aula.
Las reparaciones T167–T171 quedan registradas; esta auditoría las identifica,
no afirma que estén implementadas.
