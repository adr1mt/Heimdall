# Retrospectiva de navegación · 2026-10-04

Revisión de las diez últimas sesiones principales de Heimdall, iniciadas entre
el 2 y el 3 de octubre de 2026. Se excluye esta retrospectiva y los agentes
auxiliares como sesiones independientes. Se consultaron también las conclusiones
de los tres agentes de arquitectura/revisión vinculados a las sesiones elegidas.
Los registros de Claude de este proyecto son anteriores (septiembre).

El análisis produjo propuestas antes de implementar cambios.
Con autorización posterior del propietario, T165 las implementa:
[resultado y comprobaciones](../reviews/T165-NAVEGACION.md).
Las fuentes son los registros locales originales, contrastados con los archivos
actuales del repositorio. Las duraciones citadas son tiempo de descubrimiento
observable, no estimaciones de tiempo que se podría ahorrar.

## Resultado observado

- Ocho de diez sesiones muestran al menos una búsqueda/lectura de una ruta inexistente.
- Nueve de diez contienen salidas con aviso explícito de truncamiento: 26 salidas
  registradas con ese aviso. Es un indicador de exceso de información, no de
  que las 26 lecturas fueran innecesarias.
- Las rutas fallidas se repiten: estado supuesto en la raíz, nombres plausibles
  de módulos de copias/cadenas y ubicación supuesta de pantallas/tests.
- Se recupera el alcance de revisiones desde historia Git y chats anteriores.
- Hay documentación vigente contradictoria y comprobaciones existentes sin
  ejecución automática en hooks o CI.

## 1. Alta · Un punto de entrada para agentes y un mapa por tarea

**Evidencia.** En S9, la primera llamada intenta `cat PROGRESS.md` y
`cat TASKS.json`: ambos fallan (registro, líneas 16–19). El prompt de relevo
producido por S10 había usado esos nombres sin directorio. S1 vuelve a buscar
`TASKS.json` en la raíz (85–88); el error corta una cadena de comandos antes de
copiar el AppImage. S2 prueba Settings en `components/` y `views/` antes de
localizarlo en `routes/`. S8 busca `backups*`, `*chain*`, `grades*` y
`gui/test/backup.test.ts`. S3 busca `artifact-chain.ts`, que no existe.

**Causa.** El repositorio tiene un buen índice documental en `CLAUDE.md`, pero
no un `AGENTS.md` en la raíz. Los agentes Codex lo buscan repetidamente y
encuentran las instrucciones de Claude después. `docs/ARCHITECTURE.md` explica
bien los paquetes Go, pero trata toda la GUI como un componente único.

**Propuesta.** Añadir un `AGENTS.md` breve que dirija a `CLAUDE.md`, al estado en
`docs/project/PROGRESS.md` y a la consulta selectiva de `docs/project/TASKS.json`.
Ampliar la sección Estructura de `docs/DESARROLLO.md` con una tabla por trabajo:

| Trabajo | Entrada de código | Pruebas / referencia |
|---|---|---|
| Leer resultados | `cmd/heimdall/artifact.go`, `gui/src/main/artifact.ts` | `gui/tests/artifact-reader.test.ts`, ADR-0027 |
| Validar resultados | `internal/model/validate_json.go`, `internal/model/validate.go`, `gui/src/shared/artifact.ts` | `testdata/artifacts/corpus.json`, tests artifact-corpus de ambos árboles |
| Copiar, retener, recuperar | `gui/src/main/backup.ts` (incluye `BackupChain`) | `gui/tests/backups.test.ts`, `gui/tests/backup-recovery.test.ts`, ADR-0026 |
| Reintentar, consolidar, sesión | `cmd/heimdall/retry.go`, `consolidate.go`, `session.go` | ADR-0018, ADR-0019, ADR-0020 |
| Actualizar y distribuir | `gui/src/main/updater.ts`, `update-service.ts`, `update-download.ts` | `docs/releases/0.9.1/VERIFICACION.md`, Makefile |
| Pantallas | `gui/src/renderer/src/routes/` | `gui/src/renderer/src/stores/`, `gui/tests/` |

El mapa debe señalar dependencias difíciles de inferir, como corpus compartido
y cadenas dentro de `backup.ts`, sin inventariar cada archivo.

**Criterio.** Desde el punto de entrada, un agente encuentra las rutas de estado,
la pieza de código y sus pruebas sin búsqueda en otros proyectos ni nombres
supuestos. Los prompts de relevo usan rutas completas relativas al repositorio.

## 2. Alta · Retirar afirmaciones vigentes que contradicen decisiones aceptadas

**Evidencia actual.** `gui/README.md:10` sigue presentando T054 como estado de hoy.
Sus líneas 31–36 afirman que las contraseñas viven solo en memoria y nunca en
disco, mientras ADR-0023 y `gui/src/main/vault.ts` establecen almacenamiento
cifrado con safeStorage. Su descripción de elegir examen y aula también precede
al flujo de clases y aula derivada. S2 incluye este README entre sus búsquedas
iniciales; S1 lo consulta para distribución. No hay evidencia de que estas
sesiones implementaran un cambio incorrecto a causa de ese README.

**Propuesta.** Convertir el README de GUI en una guía técnica de navegación.
Enlazar la guía de uso y el estado actual, y dejar la política de credenciales
en ADR-0023. Conservar solo las excepciones operativas relevantes: sin cifrado
disponible no hay persistencia; stdin sigue siendo el canal al motor.
`docs/DESARROLLO.md` también enlaza `docs/adr/` desde dentro de `docs/`, dando
una ruta local inexistente; debe ser `adr/`.
El Makefile remite la instalación de Go a un PROGRESS rotatorio que ya no la
contiene: usar una referencia estable de desarrollo si ese detalle sigue siendo
necesario.

**Criterio.** Los documentos que dicen describir el presente coinciden con los
ADR aceptados y remiten al estado actual; los hitos antiguos se identifican
como históricos. Un comprobador de enlaces locales detecta rutas inexistentes;
las contradicciones semánticas se revisan con juicio humano/agente.

## 3. Alta · Guardar alcance y cierre de revisiones junto a las tareas

**Evidencia.** S7 dedica desde 21:23:46Z hasta 21:25:00Z a localizar reglas,
base, commits e historial de las sesiones antes de delegar la revisión:
aproximadamente 74 segundos y varias consultas a los mismos chats. S3 imprime
el backlog completo y luego consulta cuatro chats anteriores para contestar
qué queda. S2 recibe la petición explícita de corregir el registro que aún
indicaba revisión de arquitectura pendiente; confirma que PROGRESS ya la daba
por terminada y crea T160 para cerrar la discrepancia.

**Propuesta.** Registrar en la tarea de revisión base inicial, commits finales,
tareas incluidas y enlace al informe. Registrar estado de cierre en TASKS;
PROGRESS conserva solo resumen y referencia. Para incidencias pendientes,
guardar condiciones de reproducción y siguiente acción en el repositorio cuando
el alcance autorice escritura. Una sesión expresamente de solo lectura, como
S5/S6, mantiene esa restricción; su relevo debe incluir la evidencia necesaria.

Las decisiones históricas de `DECISIONS.md` (766 líneas) se consultan por tarea;
no se convierten en un segundo estado actual. El informe actual de T159 ya es
un buen ejemplo: incluye base, reproducción, reparación y límites.

**Criterio.** Se puede responder qué queda y qué intervalo revisar leyendo el
estado y la tarea, sin recuperar chats anteriores o reconstruir reflogs.

## 4. Media · Consultar el backlog sin cargar todo el histórico

**Evidencia.** TASKS tiene 3222 líneas. S3 vuelca todo el JSON para buscar trabajo
pendiente y luego lo filtra. S4 carga PROGRESS y TASKS completos con presupuesto
insuficiente. S6 carga DECISIONS completo, recibe truncamiento y después lo
relee por bloques. S1 vuelca un commit de investigación de 5909 líneas / 64454
tokens para investigar una alerta de un archivo concreto.

**Propuesta.** Un pequeño comando de consulta del backlog que acepte una tarea
por ID o liste solo pendientes con prioridad y dependencias. Mantener TASKS como
fuente única, sin producir otra lista mantenida a mano. El punto de entrada
indica la consulta selectiva; para el histórico, buscar el encabezado de tarea
y leer su sección. Para una alerta, leer primero el archivo señalado del commit.

**Criterio.** Las consultas habituales devuelven tareas pertinentes y sus
criterios completos sin truncamiento ni tareas DONE ajenas al trabajo.

## 5. Media · Conectar las comprobaciones existentes a un guardrail automático

**Evidencia actual.** `make check` ejecuta go vet y go test; `make gui-check`
ejecuta tipos y Vitest; build verifica preload. No hay `.github/` ni hook activo
(pre-commit solo existe como archivo `.sample`); core.hooksPath no está configurado.
No hace falta reinventar las suites. El corpus compartido Go/GUI añadido en
T157 ya protege la divergencia de validadores; debe ejecutarse en ambos árboles.

**Propuesta.** Un workflow con suites rápidas Go y GUI y verificación del build
GUI/preload. Preparar versiones y dependencias a partir de go.mod y package-lock.
SSH, Podman y la prueba de paquetes pueden conservar un circuito aparte por su
entorno. Añadir el comprobador determinista de enlaces locales a este circuito,
con exclusiones explícitas para evidencia histórica cuando proceda.

**Criterio.** Un cambio que rompa Go, tipos/tests GUI, preload o un enlace local
vigente falla automáticamente. No sustituir esa comprobación por otra norma escrita.

## 6. Media · Documentar problemas de entorno en una referencia estable de tests

**Evidencia.** S10 prueba configuración Vitest temporal y contrasta fallos de
shutdown con el código anterior antes de confirmar que las 433 pruebas pasan
fuera del aislamiento. S9, S8 y S3 vuelven a encontrar `getaddrinfo EAI_AGAIN
localhost`. S2 termina ejecutando arneses SSH/secretos secuencialmente; PROGRESS
lo recuerda, pero es información de desarrollo que sobrevivirá a ese resumen.

**Propuesta.** Añadir una sección corta a `test/README.md` o desarrollo: síntoma,
comprobación diagnóstica, comando que falló y entorno donde se verificó. Registrar
que los arneses comparten laboratorio y deben ejecutarse secuencialmente.
Una limitación del aislamiento se diagnostica antes de tocar tests/configuración;
la ejecución fuera de él sigue las autorizaciones del entorno de cada sesión.
Completar el ejemplo de `make test` en desarrollo con ambos laboratorios, como
ya especifica el Makefile.

**Criterio.** El siguiente agente puede distinguir estos síntomas de una regresión
sin repetir configuraciones temporales ni debilitar pruebas.

## Qué conservar

El HANDOFF ya es un puntero, PROGRESS permanece breve y los ADR distinguen
historia de decisiones vigentes. Conservar eso. No hace falta un glosario grande,
renombrar módulos o fragmentar aún más documentos. CLAUDE tiene 119 líneas;
las reglas suman 217. Hay repetición de política de sesión/Git entre CLAUDE,
quality y TASKS.rules, pero su poda es secundaria frente a rutas y contradicciones.
Los AGENTS globales consultados están vacíos; no hay carga global que retirar.
No se observa una necesidad demostrada de ampliar acceso a servicios externos
para resolver los problemas de navegación encontrados.

## Fuentes de sesiones

Los enlaces apuntan a registros privados locales y los números citados son
líneas JSONL, no líneas de código. No se copian transcripciones ni credenciales
al informe. Orden de inicio descendente, zona Europe/Madrid.

- S1 · 2026-10-03 08:05 · [Resolver distribución de paquetes](/mnt/datos/Applications/codex/state/codex/sessions/2026/10/03/rollout-2026-10-03T08-04-59-01a1005d-a581-7923-a272-8214a2ce1ad9.jsonl) · `01a1005d-a581-7923-a272-8214a2ce1ad9`.
- S2 · 2026-10-03 07:33 · [Reconstruir AppImage y .deb](/mnt/datos/Applications/codex/state/codex/sessions/2026/10/03/rollout-2026-10-03T07-33-02-01a10040-649b-7bf2-9d29-e3563ab4cc85.jsonl) · `01a10040-649b-7bf2-9d29-e3563ab4cc85`.
- S3 · 2026-10-03 07:24 · [Revisa pendientes fuera del aula](/mnt/datos/Applications/codex/state/codex/sessions/2026/10/03/rollout-2026-10-03T07-23-56-01a10038-0f93-7841-b94d-0844f7b81de2.jsonl) · `01a10038-0f93-7841-b94d-0844f7b81de2`.
- S4 · 2026-10-03 06:49 · [Validar defectos de recuperación](/mnt/datos/Applications/codex/state/codex/sessions/2026/10/03/rollout-2026-10-03T06-49-11-01a10018-40c8-7260-83e3-3240638e05ae.jsonl) · `01a10018-40c8-7260-83e3-3240638e05ae`.
- S5 · 2026-10-02 23:44 · [Revisar garantías de recuperación](/mnt/datos/Applications/codex/state/codex/sessions/2026/10/02/rollout-2026-10-02T23-44-57-01a0fe93-d96a-79e2-aba1-89c369cb0123.jsonl) · `01a0fe93-d96a-79e2-aba1-89c369cb0123`.
- S6 · 2026-10-02 23:35 · [Revisar garantías de recuperación](/mnt/datos/Applications/codex/state/codex/sessions/2026/10/02/rollout-2026-10-02T23-35-15-01a0fe8a-f891-7ee0-949f-d22ec5f3e583.jsonl) · `01a0fe8a-f891-7ee0-949f-d22ec5f3e583`.
- S7 · 2026-10-02 23:23 · [Revisar arquitectura de Heimdall](/mnt/datos/Applications/codex/state/codex/sessions/2026/10/02/rollout-2026-10-02T23-23-36-01a0fe80-4c56-7211-84c0-dbcff419ba8d.jsonl) · `01a0fe80-4c56-7211-84c0-dbcff419ba8d`.
- S8 · 2026-10-02 23:15 · [Unificar recorrido de copias T158](/mnt/datos/Applications/codex/state/codex/sessions/2026/10/02/rollout-2026-10-02T23-15-36-01a0fe78-fa77-70d2-a9b2-d2dd2bccc0b4.jsonl) · `01a0fe78-fa77-70d2-a9b2-d2dd2bccc0b4`.
- S9 · 2026-10-02 20:50 · [Mejorar paridad de validadores T157](/mnt/datos/Applications/codex/state/codex/sessions/2026/10/02/rollout-2026-10-02T20-50-25-01a0fdf4-1085-7961-ad4c-306653ef3894.jsonl) · `01a0fdf4-1085-7961-ad4c-306653ef3894`.
- S10 · 2026-10-02 20:26 · [Analiza lectura y validación de arte](/mnt/datos/Applications/codex/state/codex/sessions/2026/10/02/rollout-2026-10-02T20-26-08-01a0fddd-d4b6-7351-9103-7092a5d6db53.jsonl) · `01a0fddd-d4b6-7351-9103-7092a5d6db53`.
