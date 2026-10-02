# Registro de decisiones

Bitácora ligera. **No sustituye a los ADR**: las decisiones arquitectónicas
viven en [`../adr/`](../adr/) y las que siguen abiertas en
[`../design/08-DECISIONES-ABIERTAS.md`](../design/08-DECISIONES-ABIERTAS.md).
Aquí se anotan, en una o dos líneas, las decisiones tomadas durante la
ejecución que no llegan a ADR, y los cambios de estado de las que sí.

## Cuándo hace falta un ADR

Si la decisión afecta a los límites del sistema, al modelo de resultados, a las
dependencias, al contrato con la GUI o a cualquiera de los 12 principios:
**ADR**. Si es una elección local reversible dentro de una tarea: una línea
aquí.

Para cambiar una decisión aceptada: ADR nuevo que la sustituya, con la
evidencia. Nunca se edita un ADR aceptado en silencio.

## Estado de las decisiones abiertas

| # | Decisión | Se cierra en |
|---|---|---|
| D-5 | Detección de valores repetidos (anticopia) | Cuando haya un caso real; no bloquea |
| D-6 | Alumnos en paralelo por defecto (el tope por máquina ya está medido, ADR-0012) | T031 (fase 3) |
| D-8 | Presentación de `INCOMPLETE` en la GUI | T060 (fase 6) |
| D-9 | Formato definitivo de los eventos NDJSON | T050 (fase 5) |

## Bitácora

### 2026-09-21 · T067: un sobre de secretos vacío es una respuesta válida

Un aula cuyas máquinas no piden ninguna contraseña mandaba
`{"schema":1,"secrets":{}}` y el motor lo rechazaba como error de
configuración, así que ese examen solo se podía corregir desde la línea de
órdenes con `--secrets=env`. Se arregla en el motor y en un solo sitio: leer el
sobre es leerlo, y quien decide si lo que ha llegado cubre lo que el PLAN pide
sigue siendo `engine.CheckSecrets`, que nombra cada referencia que falte. No
llegar nada por stdin sigue siendo error (exit 2): son dos cosas distintas.

La política de secretos no cambia (ADR-0009) y el contrato sigue en la versión
1: el motor acepta ahora un sobre que antes rechazaba y nada más.

### 2026-09-20 · D-7 cerrada: el producto se llama Heimdall (ADR-0014)

`Evalon` era nombre de trabajo. Se cierra ahora, en fase 3, porque todavía no
hay binario publicado ni GUI adaptada: el cambio solo cuesta un renombrado
interno. Módulo, CLI, binario y documentación pasan a `heimdall`.
`docs/research/` queda intacto por ser evidencia histórica.

### 2026-09-20 · D-3 cerrada: identidad por ejecución (ADR-0011)

Dato nuevo del aula: el alumnado examina sobre máquinas virtuales desechables,
una por examen. Guardar la identidad de la máquina entre exámenes no protege de
nada y el día del examen solo puede producir un aula rechazada, que es el fallo
que tumbó la primera investigación (F-12).

El motor anota la identidad de cada máquina durante la ejecución, con su huella
en el informe, y rechaza a la que cambie a mitad. No hay fichero `known_hosts`
y nunca se toca el del profesor.

La entrada por clave SSH sale de T021: el aula usa contraseña. Queda como T023,
sin implementar hasta que haya un caso real.

### 2026-09-20 · D-2 cerrada: SSH nativo (ADR-0010)

El transporte se queda en `x/crypto/ssh`, dentro del proceso. Se cierra con
medición, no por preferencia: `transport: "ssh"` y el hostname del contenedor
en el artefacto (A-11), 4,8 s de run con un `sleep 30` y un alumno inalcanzable
dentro (A-5), y RSS plano entre 13 y 15,5 MB con salidas de 1 a 300 MB (A-6).
Delegar en el binario `ssh` metería la versión de OpenSSH y el `~/.ssh/config`
del profesor en la nota, y devolvería los secretos al terreno de `argv`.

El ejemplo del modelo de resultado pasa a ser salida real del laboratorio:
`docs/design/ejemplo-run.json`.

### 2026-09-19 · Estructura de proyecto persistente

Se convierte la investigación y el diseño cerrados en `CLAUDE.md`,
`.claude/rules/`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md` y `docs/project/`.
Ninguna decisión de producto cambia: la documentación existente se indexa, no se
reescribe.

Tres decisiones menores:

1. `HANDOFF.md` pasa a ser un puntero a `docs/project/PROGRESS.md`. Dos ficheros
   con el mismo cometido producen dos estados distintos.
2. El informe de auditoría suelto en la raíz se archiva como
   `docs/research/00-AUDITORIA-INICIAL.md`.
3. La fase 2 del roadmap incluye el formato completo (`cerca_de`, `valor:`,
   `no_contiene`) y no solo la robustez de SSH: sin esas tres primitivas no se
   puede ejecutar un examen real del curso, que es su condición de salida.

### 2026-09-19 · T001 · Toolchain Go

El módulo existe y compila. Tres decisiones operativas, ninguna arquitectónica:

1. **Go 1.27.1 del tarball oficial**, extraído en
   `/mnt/datos/Applications/Claude/toolchains/go`. `apt` ofrece 1.22 —justo el
   mínimo—, exige root e instala en `/usr`, fuera del árbol del proyecto.
2. **`go.mod` declara `go 1.22`, no la versión instalada.** El mínimo del
   proyecto es lo que debe compilar en cualquier equipo, no lo que hay aquí.
3. **El exit code 1 queda sin significado**, reservado como fallo no
   especificado, y hay un test que lo protege junto a los otros cuatro. La GUI
   distingue configuración inválida (2) de ejecución parcial (3) por el número.

### 2026-09-19 · T002 · Serialización canónica sin escape HTML

El artefacto se escribe con un `MarshalCanonical` propio (sangría de dos
espacios, `SetEscapeHTML(false)`) en lugar de `json.Marshal`. Motivo: la salida
de `ip address show` y cualquier comando con `<`, `>` o `&` debe leerse en el
artefacto tal como se envió a la máquina, no como secuencias escapadas. Es una
elección local y reversible; no cambia el modelo.

El golden del round-trip vive en `internal/model/testdata/`, no en el
`testdata/` raíz que cita `architecture.md`: `go test` lo lee por ruta relativa
al paquete. El raíz queda para exámenes e inventarios de prueba.

### 2026-09-19 · T003 · Holgura al comparar pesos y errores del motor explícitos

Dos elecciones locales dentro del cálculo de la nota:

1. Los pesos acumulados se comparan con cero con una holgura de `1e-9`. Un
   examen de 0,1 + 0,2 + 0,7 deja un residuo de coma flotante del orden de
   `1e-16` en `total - evaluable`; sin la holgura ese residuo se leería como
   «queda algo sin evaluar» y negaría la nota final a un alumno que la merece.
   Cualquier peso real está muchos órdenes de magnitud por encima.
2. `Classify` con causa `NONE` pero sin ejecución completa, sin código de
   salida o sin aserción devuelve `UNEVALUATED` con causa `ENGINE_ERROR`, no un
   `PASS` ni un `FAIL`. Es una contradicción del motor, y el principio 2 pide
   que se vea.

`Classify` devuelve además un `detail` por defecto para cada causa. El motor
puede sustituirlo por uno más concreto, nunca por vacío: una comprobación
`UNEVALUATED` sin explicación deja al profesor sin saber qué hacer.

### 2026-09-20 · T004 · El rechazo de claves desconocidas lo hace el paquete, no yaml.v3

`TASKS.json` pedía `yaml.v3` con `KnownFields(true)`. No sirve para este
formato: la opción es del decodificador de primer nivel y no llega a los tipos
anidados, y además rechazaría los campos libres del alumno (`subdominio`, `p1`),
que son legales y son justamente el material de la sustitución.

En su lugar, `internal/plan` recorre el árbol del documento contra la forma de
las structs y compara cada clave con las etiquetas `yaml`. El recorrido da tres
cosas que `KnownFields` no daba: la línea exacta de cada clave desconocida,
**todas** las de un fichero en una sola pasada, y el mensaje en español sin
nombres de tipos de Go. El alumno es el único tipo que admite claves extra, y
eso está escrito en un solo sitio.

Dos elecciones menores del mismo paquete:

1. `peso` y `timeout` tienen valores del motor (1 y 20s) cuando el examen no
   trae `por_defecto:`. Son constantes documentadas, no ceros implícitos.
2. `password:` existe en el esquema del inventario. Si no estuviera, una
   contraseña literal saldría como «clave desconocida» en vez de como lo que
   es. La valida el PLAN (T005); aquí solo se conserva para poder acusarla.

### 2026-09-20 · T005 · Cuatro elecciones al resolver el PLAN

1. **Una aserción por comprobación, exactamente una.** El §5 habla de «dos
   aserciones incompatibles» sin decir cuáles lo son. Permitir combinaciones
   obligaría a mantener una tabla de compatibilidad y haría ambiguo el motivo
   de un suspenso. Ninguno de los exámenes reales lo necesita.
2. **`${alumno.X}` ve también `id`, `nombre` y `moodle_id`,** además de los
   campos libres. Son datos del alumno como los demás, y así un
   `${alumno.id}` da el valor en vez de un «campo inexistente» desconcertante.
   Un conocido vacío cuenta como ausente, para que siga valiendo la regla de
   «o lo tienen todos, o no se usa».
3. **El alumno excluido no se resuelve.** No se le exigen ni hosts ni campos:
   no se le examina, y pedirle datos empujaría a rellenar el inventario con
   información inventada, que es justo lo que no se hace con material de aula.
4. **Una referencia `${MAYUSCULAS}` en un campo libre del alumno es error.**
   Los campos libres se sustituyen dentro de los comandos del examen; sin esta
   comprobación, un secreto escrito ahí entraría en un `cmd` y saldría en el
   resultado. La garantía del §1.4 de `security.md` depende de cerrar también
   esta puerta, no solo la del examen.

`testdata/proto/` se crea aquí, antes de T012, porque el subcomando `check`
necesitaba un proyecto válido de verdad contra el que probarse. T012 lo dará
por bueno o lo corregirá al escribir la aceptación del hito.

### 2026-09-20 · Aserciones (T007) y escritura del artefacto (T009)

Dos decisiones menores:

1. **`assert.Eval` devuelve error, no un resultado.** Cuando la ejecución no se
   completó, o cuando la aserción es de las que aún no se evalúan (`cerca_de`,
   `no_contiene`, `valor:`), no se produce un `AssertionResult` con
   `matched: false`. Un «no coincide» inventado es indistinguible de un
   suspenso legítimo y sería el camino más corto para que una avería o un hueco
   del motor acabase en la nota.
2. **El ULID se implementa en el repositorio** (26 caracteres, Crockford
   base32) en vez de añadir la dependencia que `architecture.md` permitía. Son
   cuarenta líneas y no hay nada más que necesitemos de esa librería; la regla
   de simplicidad pesa más que el permiso.

### 2026-09-20 · Sesión SSH (T008)

1. **`golang.org/x/crypto/ssh`, la dependencia que `architecture.md` ya
   permitía.** Arrastra `golang.org/x/sys` y sube la directiva `go` del módulo
   de 1.22 a 1.26; el toolchain instalado es 1.27.1, así que no cambia nada en
   la práctica.
2. **El corte duro de 8 MB cierra la sesión del comando, no solo deja de
   leer.** Dejar de leer sin cerrar bloquea al otro lado hasta que vence el
   timeout: el `head -c 300000000` tardaba 68 s en vez de 0,1 s. El límite
   existe para que una salida enorme no cueste ni memoria ni tiempo.
3. **`duration_ms` mide hasta que llega el estado de salida o vence la
   comprobación, no la limpieza posterior.** Tras un timeout se da una gracia
   de 2 s al cierre del canal y se informa con lo que haya: un servidor que no
   cierre no puede retener a un trabajador.
4. **El vector de argumentos se serializa con comillas simples** al enviarlo.
   `sshd` siempre ejecuta la petición `exec` a través de una shell remota: no
   hay forma de evitarlo. Lo que sí se garantiza es que cada argumento llega
   literal, sin reinterpretar espacios, comillas ni `;`.
5. **La ausencia del `timeout` de coreutils se prueba de verdad**: el test
   esconde el binario dentro del contenedor y lo restaura. Sin ganchos de
   prueba en el código de producción.

## T030 · Topes de concurrencia

1. **El tope por máquina cubre solo la apertura de la sesión, no los
   comandos.** `MaxStartups` cuenta conexiones sin autenticar: una sesión ya
   abierta no estorba a nadie. Poner ahí el comando serializaría la corrección
   sin ninguna razón.
2. **Esperar turno se pide contra el contexto del alumno.** Si se le agota el
   presupuesto en la cola, la comprobación sale sin evaluar por tiempo, con el
   motivo escrito, y la máquina no se apunta como caída: no se le llegó a
   preguntar nada.
3. **El valor por defecto del tope global sube de 2 a 8.** El 2 era del
   prototipo vertical. El número definitivo lo mide T031.

## T031 · Mediciones y cierre de D-6

1. **El tope global por defecto sube de 8 a 16.** Medido: 30 alumnos con
   máquina propia pasan de 24,7 s a 13,4 s por 1 MB más de memoria. ADR-0013.
2. **`test/rendimiento.sh` no es un test.** Mide y publica una tabla; solo
   falla si una medida pierde una comprobación. Que una máquina sea más lenta
   otro día no puede romper la suite.
3. **La medida que decide no es la de cien alumnos contra un servidor**, donde
   manda el tope por destino, sino la de treinta alumnos con máquina propia y
   un comando que tarda. Es el caso en el que el profesor espera.
4. **`seq` como generador de salida grande**: un único vector de argumentos,
   sin shell ni tubería, y texto de verdad en vez de bytes nulos.


## T032 · Una salida desbordada ya no se llama caída de conexión

1. **Novena causa técnica, `OUTPUT_OVERFLOW`** (ADR-0015). El corte lo hacemos
   nosotros; llamarlo `CONNECTION_LOST` mandaba al profesor a mirar la red en
   vez del comando del examen.
2. **Lo conservado no se evalúa.** Son los primeros 64 kB de una salida que
   seguía: un `no_contiene` que pasara sobre ese prefijo sería un aprobado
   inventado. La comprobación sigue `UNEVALUATED` y fuera del denominador.
3. **Los topes no se tocan**: 64 kB conservados y corte duro a 8 MB, como
   estaban.


## T040 · Los tres ficheros que lee la GUI actual

1. **T040 se parte en dos.** El escritor de datos (C6, C7, C8) y la fachada
   de línea de órdenes (C1-C4, C9, ahora **T042**) son dos trabajos con
   riesgos distintos. T041 depende de los dos.
2. **El nombre del test es el del directorio del proyecto.** No hay
   `config.yaml` ni `tt_testname` en el formato nuevo, y es justo lo que la GUI
   usa como respaldo (`main/results.ts`, C5). Los ficheros van a
   `var/<directorio>/`, al lado del artefacto canónico.
3. **La letra del resumen se escribe siempre.** Teuton dejaba la clave fuera
   para un 50 y la GUI caía en `?`; aquí `✓` es un 100, `✗` un 0, `S` un
   excluido y `?` el resto. Es el mismo valor que la GUI acaba mostrando.
4. **La causa dominante por máquina, con orden explícito**: credenciales
   rechazadas manda sobre máquina inalcanzable, y esta sobre todo lo demás. Es
   lo que el profesor tiene que arreglar primero, y el formato viejo solo
   admite una etiqueta por máquina.
5. **Una avería sin máquina conocida se etiqueta `desconocido`.** Un alumno
   `INCOMPLETE` o `NOT_EVALUATED` nunca sale sin `conn_status`: sin esa
   etiqueta la GUI publicaría un cero como si fuera la nota final.
6. **`moodle.csv` se escribe a mano, no con `encoding/csv`.** La biblioteca no
   entrecomilla el comentario y Teuton sí; el CSV sigue siendo válido y
   conserva el prefijo defensivo contra fórmulas (F-14).
7. **Ninguna credencial en `case-NN.json`.** Teuton volcaba `host1_password`
   ahí; esta capa escribe dirección, puerto y usuario, y nada más.

## T042 · La fachada de línea de órdenes que la GUI conduce

1. **`version` dice las dos cosas.** `teuton version 2.10.6 (heimdall <ver>)`:
   la primera parte es lo que la GUI busca para reconocer el binario
   (`/version\s+([\d.]+)/i`), la segunda impide que nadie confunda el motor.
2. **`--export=json` es la manera que tiene la GUI de pedir una ejecución.**
   Implica los ficheros del formato antiguo (T040) y el progreso en vivo. No
   hay más formatos: cualquier otro `--export` es error antes de tocar nada,
   porque si no la GUI acabaría leyendo un directorio que nadie escribió (C9).
3. **Una ejecución parcial sale con 0 bajo `--export=json`.** La GUI tira los
   informes de cualquier ejecución que no termine con 0 (`lib/run.ts:446`) y un
   alumno con la máquina apagada es el caso normal de un examen, que el motor
   viejo también terminaba con 0. El estado parcial viaja por los informes, que
   es donde la GUI lo lee. El artefacto canónico conserva la verdad y el código
   de salida propio (0/2/3/4) sigue intacto sin la bandera.
4. **El progreso se emite por alumno terminado, no por comprobación.** Es el
   grano más fino que publica el motor hoy; la GUI solo cuenta caracteres, así
   que su barra sigue siendo exacta. Desaparece cuando consuma NDJSON.
5. **`--case=N,M` son posiciones del aula, y no mueven el denominador.**
   Cambian a quién se evalúa, nunca qué se evalúa: los pesos y el número de
   comprobaciones son los del PLAN.
6. **`--cname=X` busca `X.yaml` en el mismo directorio.** Un nombre con
   separadores de ruta es error de configuración, no una lectura fuera del
   proyecto.

## 2026-09-20 · Heimdall deja de ser compatible con Teuton (ADR-0016)

1. **Se retira la compatibilidad, no se aplaza.** ADR-0008 aceptaba el
   adaptador para conservar la red de seguridad de la UAT de la GUI. El precio
   apareció entero en la fase 4: T043 obligaba al motor a leer `config.yaml` y
   `start.rb`, y T044 a provocar averías que el motor no comete. Pasar esa UAT
   probaba la imitación, no el motor.
2. **El contrato nativo pasa a ser lo primero.** D-9 estaba aplazado detrás del
   escritor legacy; ahora es T050, la única tarea `READY`, porque todo lo demás
   cuelga de él.
3. **La GUI vive en `gui/`, dentro de este repositorio.** Un solo release y el
   contrato siempre en la misma versión que su consumidor, a cambio de tener Go
   y Node en el mismo árbol.
4. **Nace de `teuton-gui`, no lo continúa.** Se toma la base técnica y visual
   —Electron, Vite, React, Tailwind, componentes, estilos, layouts, tests que
   sigan valiendo— y se borra en el primer commit todo lo que hable con Teuton.
   Reescribir desde cero costaba la suite de tests sin ganar nada.
5. **La capa legacy se congela, no se borra hoy.** Sigue sirviendo para pruebas
   internas y su borrado (T060) es un commit propio, cuando la GUI nativa esté
   en verde. Borrarla ya dejaría el motor sin ningún consumidor durante toda la
   fase 4.
6. **T041, T043 y T044 quedan `DROPPED`, no eliminadas.** Una tarea retirada
   con su motivo explica el camino; una tarea borrada lo esconde.
7. **No hay migrador de exámenes.** Los exámenes del curso se rehacen en el
   formato nativo (T070). Un traductor de un DSL ejecutable a un formato
   declarativo es un compilador incompleto que solo se usaría una vez.

## T050 · El contrato nativo con la GUI (ADR-0017)

1. **El artefacto es la fuente de verdad; los eventos son el progreso.** Nada
   viaja por el flujo que el artefacto no tenga, así que una GUI que se pierda
   un evento pierde progreso y nunca una nota.
2. **La salida del alumnado no entra en el flujo.** Es dato no confiable y sin
   tamaño máximo. `check.end` lleva estado, causa, detalle y duración; el texto
   está en el artefacto, acotado. Un test comprueba que una salida de 100 kB no
   asoma por el canal.
3. **`expected_checks` y `check_count` son cosas distintas y se publican
   aparte.** Uno es el total de la barra de progreso (comprobaciones × alumnos
   evaluables); el otro es el denominador, que no se mueve. Confundirlos es lo
   que hacía que un alumno roto moviera la nota de los demás.
4. **`--events` y `--export` son incompatibles.** Los dos escriben en `stdout`.
   Con el flujo encendido, `stdout` es solo suyo y el resumen en prosa no se
   imprime.
5. **`internal/events` es un paquete nuevo de primer nivel.** El contrato es una
   pieza publicada, con versión y reglas propias; `internal/report` escribe el
   artefacto en disco, atómicamente, y son dos ciclos de vida distintos.
6. **El emisor lleva su propia redacción de secretos.** Es la misma segunda
   línea de defensa que el escritor del artefacto, independiente a propósito:
   dos canales, dos defensas.
7. **El esquema del artefacto se publica y no puede desincronizarse.** Los
   tests de `internal/report` recorren el esquema campo a campo contra los
   tipos del modelo, incluidas las enumeraciones cerradas y `schema_version`.
8. **`test/eventos.sh` es el consumidor de prueba.** Lee una ejecución entera
   con nada más que el flujo y el artefacto al que apunta. Lo que no se pueda
   averiguar ahí, la GUI tampoco podrá.

## T051 · La semilla de la GUI

1. **La semilla es el armazón, no la aplicación entera.** De `teuton-gui` pasan
   la base técnica (Electron, Vite, CSP, preload aislado y sin ESM) y el sistema
   visual (`components/ui`, `globals.css`, la escala tipográfica). Las pantallas
   de ejecución, resultados, analíticas, clases y editor **no** se copian: todas
   estaban escritas contra el contrato de Teutón y se rehacen sobre el nativo en
   T052, T053, T054 y T071. Copiarlas para vaciarlas después habría dejado un
   árbol lleno de código muerto que nadie podía ejecutar.
2. **La aplicación reconoce el motor por su propia línea de versión.** Busca
   `heimdall <versión>` en la salida de `heimdall version`, que hoy lleva
   delante el prefijo de la fachada congelada y mañana, tras T060, no lo
   llevará. La GUI funciona con las dos y no acepta como motor un programa que
   no se identifique como Heimdall.
3. **El ajuste que se guarda es uno: con qué binario se lanza el motor.** Se
   escribe de forma atómica en el directorio de datos de la aplicación y no
   contiene ningún secreto. Un fichero ilegible abre la aplicación con el valor
   por defecto en vez de impedir arrancar.
4. **`gui/` es un árbol Node independiente.** `make check` no lo toca;
   `make gui-check` corre su typecheck y su suite.

## T052 · La GUI lanza el motor

1. **La aplicación entrega un directorio, no dos rutas.** El motor toma un
   directorio con `examen.yaml` dentro y el aula por `--cname`. La GUI, que
   deja elegir dos ficheros, comprueba antes de arrancar que el examen se llama
   `examen.yaml` y que el aula está en su misma carpeta, y si no lo dice en
   castellano. Aceptar rutas sueltas habría exigido tocar el CLI del motor por
   comodidad de la interfaz.
2. **Las contraseñas se piden por el nombre que el aula usa.** La aplicación
   lee el `aula.yaml` y busca las referencias `${MAYUSCULAS}`; por cada una
   pide un valor. No valida nada: el motor sigue siendo quien rechaza una
   contraseña literal en el inventario o una referencia sin valor. Una
   referencia que la GUI no viera acaba en error de configuración, nunca en una
   nota equivocada.
3. **Los secretos solo viven en memoria.** Viajan del campo de la interfaz al
   proceso principal y de ahí a `stdin` del motor, en una línea. No entran en
   `argv`, no se guardan en los ajustes y se borran al terminar la corrección o
   al cambiar de aula. `gui/scripts/secretos.sh` lo comprueba mirando `argv` y
   el entorno de todos los procesos vivos durante la corrección.
4. **La barra cuenta comprobaciones, no caracteres.** El total es
   `expected_checks` de `run.start` y cada `check.end` avanza uno. Es la
   diferencia con la GUI vieja, que contaba texto porque no tenía otra cosa.
5. **Una ejecución que no ve `run.end` está inacabada.** Aunque el proceso
   salga con 0. Se dice en pantalla, con lo que el motor escribió en `stderr`.
6. **Detener manda `SIGINT`, no mata.** Es lo que el motor espera: cancela,
   escribe el artefacto parcial y sale con 4. Matarlo tiraría todo lo ya
   corregido.
7. **Nada rojo por un fallo técnico.** Un alumno con comprobaciones sin
   evaluar sale en ámbar y con el recuento escrito; el verde es solo para quien
   terminó entero (principio 3).

## T053 · La pantalla de resultados

1. **T053 se partió en dos al llegar.** Presentar y actuar son dos trabajos:
   T053 enseña lo que el artefacto sabe; T055 decide qué se le ofrece al
   profesor ante un incompleto y cierra D-8 con un ADR. Juntas no cabían en una
   sesión sin dejar la mitad a medias.
2. **La pantalla lee el artefacto, no el flujo.** Al llegar `run.end` la
   aplicación abre el fichero al que apunta y se planta en Resultados. El flujo
   sirvió para ver avanzar; lo que se enseña sale de la fuente de verdad.
3. **Un esquema que no se conoce se rechaza, no se adivina.** Si el artefacto
   declara otra `schema_version`, la aplicación lo dice y no enseña nada. Un
   campo que cambiara de significado se leería como una nota que no es.
4. **La nota final solo existe cuando está todo evaluado.** Un `INCOMPLETE`
   enseña la provisional, dicha como provisional y con el denominador al lado.
   Un alumno al que no se pudo llegar no enseña número ninguno: un 0 se lee
   como «lo hizo mal» y no como «no se pudo mirar» (principio 3, ADR-0006).
5. **Las palabras del modelo están en un sitio y se prueban contra el motor.**
   Cada causa, cada estado académico, cada estado de alumno y cada estado del
   proceso remoto tiene su frase en castellano, y el test las contrasta con
   `internal/model/enums.go`. Una causa nueva en el motor rompe el test de la
   GUI antes que la clase.
6. **Lo que puede quedar vivo en la máquina del alumno se dice.** Un comando
   matado por timeout deja un aviso en el detalle: es trabajo del profesor y
   callarlo sería esconderlo.
7. **Una salida cortada se ve cortada**, con los bytes guardados y los que el
   comando sacó de verdad. Es la única manera de que se note que el examen pide
   más salida de la que se puede leer.

## T055 · Qué se ofrece ante un incompleto

1. **Dejarlo pendiente es lo normal y es lo que pasa si no se toca nada.** La
   aplicación no reintenta por su cuenta ni marca nada por su cuenta. Un
   incompleto es un estado legítimo de un examen; quedarse ahí no necesita
   justificación, repetir sí. ADR-0018.
2. **Se repite solo lo que no se pudo evaluar.** Un `FAIL` no se vuelve a
   intentar nunca de forma automática: sería darle a un alumno intentos que el
   resto de la clase no tuvo. Eso obliga a que el reintento sea por
   comprobación y no por alumno.
3. **Un reintento no borra el intento anterior.** El artefacto nuevo lleva de
   dónde viene y, comprobación a comprobación, qué era y por qué causa la vez
   anterior. Es rastro, no resultado: las funciones de nota no lo miran.
4. **El PLAN del reintento es el mismo PLAN, comprobado por `plan_hash` antes
   de tocar ninguna máquina.** Si el examen o el aula han cambiado, el
   reintento no empieza: exit 2. La consecuencia práctica es que el reintento
   sirve cuando se arregla la máquina, no cuando se arregla el `aula.yaml`.
5. **Nada automático fabrica una nota.** Lo que no se repite sale sin evaluar
   con causa «no se llegó a ejecutar», nunca suspenso, y mientras quede algo
   sin evaluar no hay nota final. Eso deja el artefacto de un reintento parcial
   sin nota final a propósito: consolidar una cadena de correcciones es T057 y
   necesita una regla escrita y probada, no un atajo en la pantalla.
6. **Marcar o resolver a mano queda fuera del MVP.** Obligaría a un resultado
   que no viene del motor y a defender en cada vista que no se confunde con uno
   real. Si vuelve, será como dice ADR-0006: artefacto aparte, con autor y
   fecha, y conservando intacto lo que dijo el motor.
7. **Comprobaciones y peso se enseñan como dos cifras distintas.** «Falta 1 de
   3» y «falta 7 de 10 de peso» son la misma situación contada de dos maneras,
   y con una sola se lee un agujero grande como pequeño.
8. **El reintento no abre ninguna vía nueva hacia los secretos.** Viaja como la
   ruta del artefacto anterior y nada más; el motor decide qué repite. Los
   comandos del detalle siguen siendo los que publica el artefacto, ya saneados.

## T054 · El histórico

1. **La verdad son los artefactos, no un índice aparte.** El histórico es la
   lista de los `var/run-*.json` del proyecto, leídos en el momento. Una base
   de datos o un fichero de índice sería una segunda versión de los resultados
   que podría discrepar de la primera, y el principio 12 dice cuál manda.
2. **Abrir una ejecución anterior es abrir su artefacto en la misma pantalla.**
   No hay vista de «resultado histórico» distinta de Resultados: si fuera otra
   pantalla, tendría que mantenerse al día con ella y acabarían enseñando cosas
   distintas del mismo fichero.
3. **Un artefacto que no se puede leer conserva su fila, con el motivo.** Una
   corrección que ocurrió no puede desaparecer de la lista porque su fichero
   esté roto: eso sería el error silencioso del principio 2.
4. **Un proyecto sin `var/` no es un error.** Es un examen que todavía no se ha
   corrido, y se dice tal cual.
5. **La lista se corta en las 50 más recientes.** Cada fila obliga a leer el
   artefacto entero para resumirlo, y una carpeta con un curso entero dentro
   dejaría la ventana colgada. Las anteriores siguen en la carpeta y se abren
   con «Abrir otro resultado…».
6. **Mientras hay una corrección en marcha no se abre ninguna del histórico.**
   Sustituiría en pantalla lo que se está corrigiendo ahora mismo.
7. **T054 se dividió antes de implementarla.** Juntaba histórico, modo examen,
   modo proyector, analíticas y exportación: cuatro entregas y ninguna
   verificable por separado. Quedan T054, T056, T058 y T059.

## T056 · Las notas fuera de la aplicación

1. **La escala la convierte la GUI, nunca el motor.** El artefacto guarda el
   0-100 y los números crudos (architecture.md §8); exportar solo lee. Dos
   escalas fijas, 0-10 y 0-100: un máximo arbitrario invita a una conversión
   que nadie puede volver a comprobar.
2. **Quien no tiene nota final exporta que no la tiene.** Columna de nota
   vacía y el motivo al lado. La provisional no viaja: en una hoja de cálculo
   no se distingue de una cerrada, y un 0 por una máquina apagada sería un
   suspenso que el alumno no se ha ganado (principio 3, ADR-0006).
3. **Solo viajan los datos de la hoja de notas.** Nombre, identificadores,
   estado, nota y recuento. Ni comandos, ni salida de las máquinas, ni por
   tanto secretos: una hoja de notas se reenvía por correo.
4. **CSV con punto y coma, coma decimal y BOM.** Es lo que abre una hoja de
   cálculo en español sin romper los acentos ni partir las columnas. Los
   campos que empiezan como una fórmula salen prefijados (F-14).
5. **La escala se guarda con las preferencias de pantalla, no con la
   corrección.** Es del profesor y de su máquina; ningún artefacto la nombra.

## T057 · Consolidar una cadena

1. **ADR-0019**, que cierra lo que ADR-0018 §5 dejó abierto: la regla es, por
   comprobación, el resultado de la ejecución más reciente que la evaluó.
2. **La nota consolidada la calcula el motor.** La GUI la tiene todo a mano y
   aun así no suma: `ComputeScore` es la única definición de qué es una nota
   (principio 12), y una segunda copia en TypeScript podría divergir en el
   redondeo sin que nadie se entere.
3. **Subcomando `consolidate`**, que escribe por la salida estándar y no toca
   ningún fichero. Lleva `kind: "consolidation"` para que nada lo lea como un
   artefacto.
4. **Un eslabón que no se puede leer para la consolidación entera.** Media
   cadena convertiría lo que falta en «sin evaluar» sin decirlo.
5. **«Intentos» es lo que hubo antes.** Una comprobación que un reintento
   posterior no seleccionó sale `NOT_RUN` en su artefacto y no se cuenta como
   un intento más.
6. **T057 se dividió en motor (T057) y pantalla (T061).** La regla y la nota
   son de un sitio, la vista de otro, y mezclarlas en una tarea habría metido
   el cálculo de la nota en la interfaz por comodidad.

## T062 · La sesión de examen

1. **ADR-0020**, que cierra D-10: en una sesión de examen la nota de cada
   alumno es la **mejor vuelta con nota completa**, y eso es lo contrario de
   ADR-0019 a propósito. En un reintento se repite lo que falló y lo nuevo
   sustituye a lo viejo; en un examen el alumno sigue trabajando y cada vuelta
   es una fotografía más del mismo examen.
2. **Se elige la vuelta entera, no la mejor comprobación de cada una.** Coser
   lo mejor de cada vuelta construiría un alumno que nunca existió: uno que
   tuvo el servidor bien a las 10:20 y el cortafuegos bien a las 11:00 sin que
   las dos cosas lo estuvieran a la vez nunca.
3. **Solo compiten las vueltas completas.** De ahí sale la garantía que
   importa: una vuelta posterior no puede rebajar nada, así que la máquina que
   se apaga al final no baja una nota ya puesta (principio 3).
4. **`FINISHED` es el examen entero, no el examen entero mirado.** Todas las
   comprobaciones evaluadas y todas en `PASS`. Con un 8 y las dieciséis
   evaluadas el alumno sigue `ACTIVE`: puede arreglarlo y la sesión lo tiene
   que seguir corrigiendo. Se compara sobre los pesos crudos, no sobre el
   entero 0-100, porque un 99,6 % redondea a 100 y no es haber terminado.
5. **Tres estados de sesión: `ACTIVE`, `FINISHED`, `EXCLUDED`.** Contestan a si
   la vuelta siguiente tiene que corregir al alumno, no a si ya tiene nota: eso
   lo dicen la nota y la vuelta de la que sale.
6. **Las vueltas se leen en el orden en que se corrieron**, y una fuera de
   orden es un error, no algo que se arregle por dentro: si el orden no es el
   real, «de qué vuelta sale la nota» es mentira.
7. **Empate: gana la primera vuelta que llegó**, que es cuando el alumno llegó
   ahí.

## T106 · Las clases del profesor

1. **ADR-0021**: la aplicación guarda sus datos propios en el directorio de
   datos de usuario, un fichero JSON por tipo de dato y escritura atómica.
   Nada de lo que guarde entra en el camino de la nota: el motor sigue
   recibiendo examen, aula y secretos por stdin.
2. **Un fichero de datos ilegible no se sustituye por una lista vacía.** Es la
   diferencia deliberada con `settings.json`: volver a elegir la ruta del motor
   cuesta diez segundos, volver a apuntar veintiséis alumnos no. Se avisa, el
   fichero no se toca y la escritura queda bloqueada hasta arreglarlo.
3. **La garantía de «ninguna contraseña» es estructural, no un filtro.** Lo que
   se escribe se serializa campo a campo desde el modelo, así que un campo que
   no es de una clase no llega al disco aunque alguien lo mande por IPC o lo
   escriba a mano en el fichero.
4. **Una clase no lleva la ruta de su aula.** El aula depende del examen y sale
   de la clase en T107; meterle una ruta ahora habría sido andamio. Hasta
   entonces el fichero de aula sigue eligiéndose, ya dentro de los detalles
   avanzados.
5. **El identificador del alumno es obligatorio y único; el contacto no.** Sin
   identificador el examen no tiene cómo llamar al alumno; el correo o el
   identificador de Moodle es para el profesor y puede faltar.
6. **La clase se valida antes de guardar, no al corregir.** Un identificador
   repetido o un alumno sin máquina se dice al teclearlo: descubrirlo con la
   clase ya sentada delante de los ordenadores cuesta el examen.

## T107 · El aula generada

1. **ADR-0022**: el aula que escribe la aplicación es un artefacto derivado de
   la clase, no un documento del profesor. Fuente de verdad, la clase.
2. **Un examen no pertenece a una clase.** El motor recibe la carpeta y el
   nombre del fichero de aula por separado, así que varias aulas conviven en
   la carpeta de un examen y cada corrección usa la suya. La restricción del
   motor era «misma carpeta», nunca «una clase».
3. **Dos cerrojos contra pisar un aula ajena**: el nombre reservado
   (`aula-heimdall-<id de la clase>.yaml`) y la marca dentro del fichero. Ante
   la duda no se escribe y se dice por qué.
4. **El nombre del fichero cuelga del identificador de la clase, no del
   nombre.** Renombrar «2SMX C» no deja una copia huérfana detrás.
5. **La clase gana columnas propias**, como las tenía Teutón GUI. No es un
   extra: tres de los exámenes de prueba piden datos por alumno que no son la
   máquina (`subdominio`, `p1`…`p10`), y sin columnas una clase no podía
   corregirlos. Viajan al aula como campos libres del alumno.
6. **Una columna no puede llamarse como una clave del aula** (`id`, `nombre`,
   `moodle_id`, `excluido`, `hosts`): pisaría la identidad del alumno sin que
   nadie lo dijera. Se rechaza al teclearla.
7. **El puerto se escribe solo cuando no es el de siempre.** Escribir 22 en
   cada fila escondería qué alumnos son realmente la excepción.

## T113 · Las copias de seguridad de las notas

1. **La copia lleva las notas, no las pruebas.** Guarda la nota de cada alumno
   y el estado y el peso de cada comprobación; deja fuera la salida de las
   máquinas y lo que se comparó. Dos razones: la salida de un alumno es dato no
   confiable y no tiene por qué estar en una copia que nadie va a auditar, y lo
   que se pierde al borrar una carpeta son las notas, no la evidencia. La copia
   restaurada lo dice en el propio fichero y en la pantalla.
2. **Las copias viven en la carpeta de datos de la aplicación**, nunca dentro
   de la del examen. Una copia dentro de la carpeta que se borra no es copia.
3. **Restaurar solo puede añadir.** Una corrección que ya está en la carpeta no
   se sobrescribe jamás: el artefacto del motor tiene la evidencia entera y la
   copia solo las notas, así que pisarlo bajaría lo que el profesor ya tiene.
   El botón no puede, ni por error, bajar una nota guardada.
4. **La copia se hace sola al terminar cada corrección** y se repara sola: una
   corrección cuya copia se borró vuelve a copiarse en la siguiente. No hay
   botón de «copiar» porque no hay nada que decidir.
5. **Un fallo al copiar no rompe la corrección que acaba de terminar.** La
   copia es una red de seguridad, no un paso de la evaluación.

## T060 · La retirada de la capa de compatibilidad

1. **Se borra entera**, como decía ADR-0016: `internal/legacy`, `--compat`,
   `--export=json`, `--case`, la línea de versión con nombre de Teuton, la
   tabla `DSL Stats` de `check` y `06-LEGACY-WRITER.md`. Un commit.
2. **`--cname` se queda.** ADR-0016 la listaba como parte de la fachada, pero
   dejó de serlo: desde ADR-0022 cada clase tiene su aula dentro de la carpeta
   del examen y la aplicación nombra ese fichero en cada ejecución. Es contrato
   nativo vivo y así queda escrito en `09-CONTRATO-GUI.md`.
3. **A-10 se retira, no se cierra.** Pedía los ficheros del formato viejo; sin
   ese formato el criterio no tiene objeto.
4. **`HEIMDALL_SECRET_TEST_12345`**: el secreto del laboratorio llevaba nombre
   de Teuton. Solo era un nombre, pero no queda ninguno.

## T114 · La actualización automática

1. **Sin `electron-updater`.** La política entera —cuándo se puede preguntar,
   qué se acepta como versión, cuándo se instala— cabe en un módulo propio que
   no importa electron y que los tests ejecutan sin red. Una dependencia que
   trae su propio calendario de comprobaciones y sus propios diálogos habría
   sido más código, no menos, y ninguno de ellos bajo control.
2. **Solo el AppImage se actualiza solo.** El `.deb` es de apt y el aula no
   tiene que elegir entre dos mecanismos. Sin AppImage no se pide nada a la
   red: la comprobación ni siquiera empieza.
3. **La red se pregunta una vez, un minuto después de abrir.** Ese minuto es
   el más ocupado de la hora y la comprobación va detrás; además da tiempo a
   encender el modo examen, que la cancela antes de la primera petición.
4. **Solo versiones `1.2.3` y solo del repositorio del proyecto.** Una versión
   de pruebas no se instala sola en una máquina de aula, y una descarga que
   apunte fuera de las releases de Heimdall no es una actualización.
5. **Un fallo es una línea de registro.** Sin red, sin permisos o con la
   respuesta rota, la aplicación arranca igual y no aparece ningún diálogo
   delante de la clase. El aviso de que hay versión nueva tampoco sale en el
   proyector.

## T126 · La contraseña del aula se recuerda cifrada

1. **Se guarda una, no una por máquina ni por alumno.** En el aula real todas
   las máquinas comparten cuenta y la misma todo el curso. Guardar un mapa de
   credenciales sería una generalización sin caso de uso.
2. **Una sola casilla en la pantalla.** Pedía un valor por cada referencia en
   mayúsculas del aula, que es jerga del fichero y no algo que el profesor
   tenga que ver. Ahora pide «la contraseña de las máquinas del aula».
3. **Sin cifrado disponible no se guarda nada.** Antes que un fichero en claro
   con la contraseña del aula, se sigue tecleando en cada examen.
4. **El almacén no importa electron.** Recibe el cifrador como parámetro, así
   que lo que este módulo existe para garantizar —que no se escribe nada
   legible— se prueba sin sesión de escritorio. Se comprobó además contra el
   `safeStorage` real de la máquina.
5. **ADR-0023 sustituye el punto 4 de ADR-0021**, que prohibía escribir
   cualquier contraseña. La prohibición sigue en pie para `settings.json` y
   `classes.json`.

## 2026-10-02 · Cierre de la auditoría

- ADR-0024: supervisor remoto con argumentos literales y prueba de terminación;
  cancelación local publica UNKNOWN. La señal TERM invalida el registro normal.
- ADR-0025: evidencia recortada, anticomprobaciones, límites numéricos y mejor
  vuelta sin redondear. Sustituye el criterio de elección de ADR-0020 §1.
- T127–T144 reparan las 18 incidencias; evidencia y límites en
  `docs/audits/2026-10-02/REPARACION.md`.

## T148 · Retención de cadenas de copias (ADR-0026)

Las 50 correcciones recientes conservan todos sus antecedentes, hasta 50 por
cadena y 2500 ficheros por examen. Una cadena incompleta se avisa y no se ofrece
como recuperable. Se seleccionan las copias existentes después de copiar.
