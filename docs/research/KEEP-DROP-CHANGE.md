# Conservar / eliminar / cambiar

Marcas: **[PRUEBA]** reproducido · **[CÓDIGO]** leído · **[PROPUESTA]** decisión
para el motor nuevo, no un hecho sobre Teuton.

---

## CONSERVAR

Comportamientos que el sucesor debe replicar porque funcionan y el aula depende
de ellos.

| # | Qué | Evidencia |
|---|---|---|
| K-1 | **Un alumno = una fila de inventario**, con campos libres que el test puede leer. Es el modelo mental del profesor. | **[PRUEBA]** todos los proyectos |
| K-2 | **Nota entera 0-100** calculada como `100 * peso_superado / peso_total`. Simple, explicable a un alumno. | **[PRUEBA]** `c01-normal`: 16/26 da 62 |
| K-3 | **Pesos por comprobación.** | **[PRUEBA]** `c01-normal` |
| K-4 | **Agrupar comprobaciones** (`group`), que la GUI usa para la tasa de éxito por bloque. | **[PRUEBA]** `verify:parsing` |
| K-5 | **Ejecución en paralelo.** 2,3 s vs 127 s con 100 alumnos. | **[PRUEBA]** `s09-scale` |
| K-6 | **Una sesión SSH por alumno y host**, reutilizada para todas las comprobaciones. | **[CÓDIGO]** + **[PRUEBA]** `s02-ssh` |
| K-7 | **Un error de conexión nunca puede hacer aprobar** una comprobación negativa (`expect_none`). | **[PRUEBA]** `s04-none` |
| K-8 | **`conn_status` por alumno** y la tabla CONN ERRORS en terminal. La idea es correcta; falta extenderla. | **[PRUEBA]** `s03-sshfail` |
| K-9 | **Comando previo de validación** (`teuton check`) que no toca las máquinas. | **[PRUEBA]** |
| K-10 | **Exportación a CSV de Moodle** y `tt_moodle_id` por alumno. | **[PRUEBA]** `c12-csv` |
| K-11 | **Salida de progreso en vivo** durante la ejecución. La forma cambia (NDJSON), la necesidad no. | **[PRUEBA]** `lib/progress.ts` |
| K-12 | **Dos ficheros: inventario y examen.** La GUI, el editor y el flujo de proyectos se apoyan en esa separación. | **[CÓDIGO]** GUI |
| K-13 | **Exit code 1 en los fallos duros.** Ya funciona para YAML ilegible, error de sintaxis y excepción. | **[PRUEBA]** |
| K-14 | **`tt_skip` por alumno**, para reevaluar a uno solo. | **[PRUEBA]** `c13-skip` (roto en 3.0.0, F-11) |
| K-15 | **Selección de casos por línea de órdenes** (`--case=1,3`). La GUI la usa para reevaluar a un alumno a mitad de examen. | **[CÓDIGO]** GUI |

---

## ELIMINAR

| # | Qué | Por qué |
|---|---|---|
| D-1 | **El DSL Ruby ejecutable.** | Causa directa de F-02 (typo silencioso), del denominador variable por alumno (`c14-check`), de la imposibilidad de contar comprobaciones por adelantado y de que el fichero de examen sea código sin sandbox. Es la decisión de la que cuelgan casi todas las demás. |
| D-2 | **`method_missing` catch-all + `respond_to_missing? -> true`.** | F-02. Un identificador desconocido debe ser un error que impida ejecutar, no una macro inexistente. |
| D-3 | **Telnet.** | 61 líneas, contraseñas en claro por la red, sin uso defendible en 2026. |
| D-4 | **El salto por pasarela (`hostN_route`).** | **[CÓDIGO]** Está roto en Linux (falta el binario `ssh` tras `sshpass`) y pone la contraseña en `argv`. Si hace falta un salto, es `ProxyJump` nativo, no reconstruir la orden. |
| D-5 | **Cinco formatos de informe paralelos** (txt, html, xml, yaml, colored_text). | Cinco formateadores que mantener, cinco sitios por los que se escapan los secretos (`SECURITY.md` §1). Uno nativo (JSON) + el HTML lo genera la GUI. |
| D-6 | **`macro` / `define_macro` / `use`.** | Reutilización a base de `instance_eval` y `Dir.glob`. En YAML declarativo el equivalente es incluir ficheros, sin ejecución. |
| D-7 | **El modo «monitorización de servidores».** | Un objetivo de producto distinto que arrastra diseño. El aula no lo necesita. |
| D-8 | **`unique` / hall of fame.** | Detectar valores repetidos entre alumnos (anticopia) es útil, pero hoy pone la nota a **0** directamente (`report.rb:78`). Si se conserva, debe ser una **marca**, nunca un cambio de nota automático. |
| D-9 | **La columna STATE derivada de la nota.** | **[CÓDIGO]** `grade < 50` se pinta como `?` y la constante se llama `error`. Induce a error. El estado técnico va aparte. |
| D-10 | **`send` (envío de correo) y `upload` (SFTP).** | Fuera del núcleo. Si hacen falta, son pasos posteriores sobre el JSON. |

---

## CAMBIAR

| # | Qué | Cómo | Motivo |
|---|---|---|---|
| C-1 | Ejecución de comandos | **Vector de argumentos, sin shell**, o shell explícito y declarado | F-09 (exit codes 1/127/0), inyección (`SECURITY.md` §4), dependencia del `locale` |
| C-2 | stdout y stderr | **Separados** y ambos conservados (recortados a un tope) | **[PRUEBA]** hoy se mezclan en local y en SSH, y del contenido solo se guarda `"(N lines)"` |
| C-3 | Timeouts | **Por comprobación, por alumno y por ejecución**, con cancelación efectiva del proceso remoto | F-04: hoy solo hay 30 s de conexión, y queda un proceso huérfano en la máquina del alumno |
| C-4 | Concurrencia | **Tope configurable** (por defecto algo así como 8-16 alumnos a la vez) | F-05: 53 ceros de 100 causados por el propio Teuton |
| C-5 | Aislamiento de alumnos | **Cada alumno es independiente**: un fallo suyo no toca a los demás ni impide escribir informes | F-03: hoy una excepción borra la clase entera |
| C-6 | Reintentos | **N reintentos con espera** solo ante fallo de **conexión**, nunca ante un resultado académico | F-15 + F-05 |
| C-7 | Estado de la comprobación | **Enum explícito**, no un booleano | F-07: hoy avería y suspenso son el mismo `check: false` |
| C-8 | Secretos | **Nunca en el fichero de examen ni en el informe**; referencia por nombre, valor desde el entorno | `SECURITY.md` |
| C-9 | Escritura de informes | **Atómica** (fichero temporal + `rename`), con id de ejecución, y **parcial si se cancela** | F-13 y F-16 |
| C-10 | Config ausente o sin casos | **Error**, no un alumno «anonymous» con un 100 | F-06 |
| C-11 | Comandos que no se llegan a ejecutar | Aparecen en el informe como `NOT_RUN` y **siguen contando en el denominador** | F-02: hoy desaparecen y la nota sube |
| C-12 | `moodle.csv` | Escrito con una librería CSV de verdad, con el prefijo defensivo contra fórmulas | F-14 |
| C-13 | Claves SSH | Soporte nativo de OpenSSH moderno, `ProxyJump` y `known_hosts` | F-12: hoy hay que convertir la clave a PEM y una entrada ed25519 tumba la ejecución |
| C-14 | Mensajes de error | Legibles, sin trazas, apuntando al fichero y la línea | F-10: hoy el propio manejador de errores revienta |
| C-15 | Localización de la salida | Junto al proyecto y con nombre determinista, no relativa al cwd | **[PRUEBA]** hoy depende de desde dónde se lance |

---

## Taxonomía de estados **[PROPUESTA]**

La propuesta de partida era: `PASS FAIL ERROR TIMEOUT NOT_RUN CANCELLED`. Tras
las pruebas, **falta poco pero lo que falta importa**, y sobra una distinción.

Dos ejes separados, porque mezclarlos es exactamente el defecto de Teuton:

### Eje 1 — resultado académico de la comprobación

| Estado | Significado | Cuenta en el denominador |
|---|---|---|
| `PASS` | se comprobó y se cumple | sí, suma |
| `FAIL` | se comprobó y no se cumple | sí, no suma |
| `UNEVALUATED` | no se pudo comprobar por causa técnica | **no cuenta en absoluto** |

Solo tres. La nota se calcula sobre `PASS + FAIL`, y el informe dice cuántas
quedaron `UNEVALUATED`. Esto resuelve el caso de `s06-drop`: el alumno no saca
33, saca «2 de 3 comprobaciones no evaluables» y el profesor decide.

### Eje 2 — causa técnica (solo tiene sentido con `UNEVALUATED`)

| Causa | Ejemplo real de esta investigación |
|---|---|
| `CONNECT_FAILED` | puerto cerrado, host inalcanzable (`s03-sshfail`) |
| `AUTH_FAILED` | contraseña o usuario incorrectos (`s03-sshfail`) |
| `TIMEOUT` | el comando no termina (`s05-hang`) |
| `CONNECTION_LOST` | la máquina se apaga a mitad (`s06-drop`) |
| `NOT_RUN` | no se llegó a ejecutar (fallo anterior, o cancelación) |
| `CANCELLED` | el profesor paró el examen |
| `ENGINE_ERROR` | fallo del propio motor; nunca debe ser silencioso |

Por qué así y no la lista plana propuesta:

1. **`ERROR` era un cajón.** Teuton ya tiene uno (`conn_status: "error"`) y
   **[PRUEBA]** mete dentro timeout, conexión rechazada e `IOError`. Repetirlo
   sería repetir el problema.
2. **`PASS/FAIL/ERROR/TIMEOUT/...` en un solo enum obliga a responder «¿esto
   resta nota?» en cada sitio donde se consume.** Con dos ejes la respuesta está
   en el tipo: `UNEVALUATED` nunca resta.
3. **`TIMEOUT` y `CANCELLED` no son hermanos de `PASS`**: son causas de no haber
   podido evaluar. Ponerlos al mismo nivel es lo que hace que hoy la GUI tenga
   que inferir `isUnevaluated`.
4. **Distinguir `CONNECT_FAILED` de `AUTH_FAILED` sí es útil en el aula**: uno es
   «enciende la máquina», el otro «te has equivocado de contraseña». Teuton ya
   lo distingue y es lo mejor que tiene (K-8).

### Estado del alumno completo

Derivado, no almacenado aparte: `OK` (ninguna `UNEVALUATED`), `PARCIAL` (alguna),
`SIN_EVALUAR` (todas). Es lo que la GUI necesita para el badge y la matriz sin
inferir nada.
