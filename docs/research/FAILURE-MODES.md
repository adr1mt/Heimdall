# Modos de fallo de Teuton

> Qué hace Heimdall con cada uno de estos fallos: [docs/MODOS-DE-FALLO-HEIMDALL.md](../MODOS-DE-FALLO-HEIMDALL.md).

Ordenados por daño a la nota. **[PRUEBA]** = reproducido; **[CÓDIGO]** =
inferido leyendo el código.

Columna «3.0.0»: si el fallo sigue presente en el HEAD del repositorio.

| id | Fallo | Daño | 3.0.0 |
|---|---|---|---|
| F-01 | Host `127.0.0.x` se evalúa en la máquina del profesor | nota falsa, silenciosa | sí |
| F-02 | Un typo en el DSL borra la comprobación y encoge el denominador | nota falsa, silenciosa | sí |
| F-03 | Un alumno que revienta aborta la clase entera, sin artefactos | se pierde todo | sí |
| F-04 | Sin timeout de comando: un `sleep` cuelga Teuton para siempre | se pierde todo | sí |
| F-05 | Concurrencia sin límite: el propio Teuton provoca ceros | 53 % de ceros con 100 alumnos | sí |
| F-06 | Sin `config.yaml` se inventa un alumno «anonymous» con un 100 | nota falsa | sí |
| F-07 | Error técnico y fallo académico son el mismo `check: false` | nota injusta | sí |
| F-08 | La nota depende del idioma del equipo del profesor | 80 vs 60 | sí |
| F-09 | Exit codes inconsistentes según los metacaracteres del comando | nota falsa | sí |
| F-10 | El manejador de errores revienta él mismo | diagnóstico ilegible | sí |
| F-11 | `tt_skip: true` aborta la ejecución | regresión | **solo 3.0.0** |
| F-12 | Claves SSH modernas hacen caer la ejecución entera | no se puede usar clave | sí |
| F-13 | Ejecuciones simultáneas se pisan los informes | corrupción | sí |
| F-14 | `moodle.csv` sin librería CSV: inyección y filas duplicadas | nota en el alumno equivocado | sí |
| F-15 | Sin reintentos | nota injusta | sí |
| F-16 | Cancelar no guarda nada | se pierde todo | sí |

---

## F-01 · Un host `127.0.0.x` se evalúa en la máquina del profesor

**[PRUEBA]** (`s01-ssh`) `config.yaml` con `host1_ip: 127.0.0.1`,
`host1_port: 2201` y un contenedor OpenSSH escuchando ahí. `run "whoami", on:
:host1` devolvió **`adr1`** (la cuenta del profesor), no `alumno`.

Causa **[CÓDIGO]**, `execute_manager.rb:46`:

```ruby
elsif ip.to_s.downcase == "localhost" || ip.to_s.include?("127.0.0.")
  ExecuteLocal.new(@parent).call
```

Es una comparación por **subcadena**, y gana a la configuración explícita de
puerto, usuario y contraseña. El único rastro es `conn_type: "local"` en el
JSON; no hay aviso alguno.

Por qué importa en un aula real: un túnel SSH, un `port-forward` de VirtualBox o
una máquina virtual local son exactamente el caso `127.0.0.1:220X`. El examen
se corrige contra el equipo del profesor y todos los alumnos sacan la misma
nota.

Se esquiva poniendo `host1_protocol: ssh`, pero eso hay que saberlo.

---

## F-02 · Un typo en el DSL borra la comprobación y encoge el denominador

**[PRUEBA]** (`c02-fail`) Cuatro `target` con pesos 1, 1, **5**, 1. El tercero
escribe `expct` en vez de `expect`. Resultado:

```
logs: ["[20:02:35] ERROR: DSL 'expct' not found!"]
targets en el informe: 3   (falta el del peso 5)
max_weight: 3.0            (debería ser 8.0)
grade: 33
```

La comprobación de peso 5 **no aparece en el informe**. No es que salga
suspendida: no existe. El examen se puntúa sobre 3 puntos en vez de sobre 8, y
el único indicio es una línea de log entre el resto de la salida. El proceso
termina con **exit 0**.

Causa **[CÓDIGO]**, `case/dsl/macro.rb:35-47`: `method_missing` atrapa cualquier
nombre desconocido y lo trata como invocación de macro; `respond_to_missing?`
devuelve `true` siempre. Un identificador mal escrito no es un error de
sintaxis, es una macro que no existe: se registra y se sigue.

Este es el fallo más peligroso del sistema, porque es silencioso, afecta a toda
la clase por igual y el único síntoma (una nota más alta de lo debido) no
levanta ninguna sospecha.

---

## F-03 · Un alumno que revienta aborta la clase entera

**[PRUEBA]** (`c10-isolation`) Tres alumnos; el `start.rb` lanza una excepción
solo para el segundo (`raise ... if _tt_members.include?("BOOM")`).

```
exit=1
var/c10-isolation/  -> VACÍO
```

Ni el alumno A ni el C, que funcionaban, tienen informe. La ejecución entera se
pierde. Reproducido igual en 2.10.6 y en 3.0.0.

Causa **[CÓDIGO]**: `threads.each(&:join)` (`ext/check_cases.rb:49`) relanza en
el hilo principal la excepción del hilo que murió, y no hay `rescue` en el
camino. Los informes se escriben al final, así que nada llega a disco.

Viola directamente el principio «un alumno roto no bloquea al resto».

---

## F-04 · Sin timeout de comando

**[PRUEBA]** (`s05-hang`) `run "sleep 100000", on: :host1`. Teuton siguió vivo
hasta que un `timeout 60` externo lo mató. `var/s05-hang/` quedó **vacío**, y en
el contenedor quedó el `sleep` huérfano.

Causa **[CÓDIGO]**: `Net::SSH.start(..., timeout: 30)` acota **solo el
establecimiento de la conexión**. `sessions[host].exec!(cmd)`
(`execute_ssh.rb:52`) no tiene ningún límite. `Open3.capture2e` tampoco.

En un examen esto significa: un alumno con un proceso colgado (un `apt` esperando
confirmación, un servicio que no arranca, un `nc -l`) bloquea la corrección de
toda la clase indefinidamente, y la única salida es matar el proceso, con lo que
se pierde todo (F-16).

Esta es la razón por la que la GUI tiene un *watchdog* de 30 s y un
`cycleLimitMs`: no puede arreglar el motor, solo matarlo a tiempo.

---

## F-05 · La concurrencia sin límite provoca ceros por sí sola

**[PRUEBA]** (`s09-scale`) El mismo examen de 3 comprobaciones, contra **el mismo
sshd**, variando solo el número de alumnos:

| Alumnos | notas |
|---|---|
| 10 | 10 con 100 |
| 30 | 23 con 100, **7 con 0** |
| 100 | 47 con 100, **53 con 0** |

Los ceros no son de alumnos peores: son conexiones rechazadas. Confirmado
subiendo `MaxStartups` de sshd a 300 y repitiendo los 100 alumnos: **100 notas de
100**.

Causa **[CÓDIGO]**: un `Thread` y una sesión SSH por alumno, todas a la vez, sin
límite (`ext/check_cases.rb:48`). `MaxStartups` de OpenSSH vale `10:30:100` por
defecto: por encima de 10 conexiones sin autenticar empieza a descartar al azar.

En un aula con una máquina por alumno el límite por host no se alcanza, pero el
mecanismo es el mismo y aparece en cuanto hay un salto por pasarela, un servidor
compartido o simplemente una red saturada. Lo importante no es el número: es que
**Teuton convierte un rechazo transitorio de conexión en un 0 definitivo**, sin
reintentar (F-15) y sin distinguirlo de un examen mal hecho (F-07).

---

## F-06 · Sin `config.yaml` se inventa un alumno con un 100

**[PRUEBA]** (`c07-noconfig`) Directorio con `start.rb` y **sin** `config.yaml`:

```
| CASE | MEMBERS   | GRADE | STATE |
| 01   | anonymous | 100.0 | ✔     |
exit=0
```

Causa **[CÓDIGO]**, `config_file_reader.rb:8`: si el fichero no existe devuelve
`minimum_configuration_with_one_case`, que fabrica un caso `tt_members:
"anonymous"`. Con `--cname` mal escrito se llega al mismo sitio.

**[PRUEBA]** Variante: un `config.yaml` **sin sección `cases`** (`c06-nocases`)
da una tabla vacía y **exit 0**. Ninguna de las dos situaciones es un error para
Teuton.

---

## F-07 · Error técnico y fallo académico son el mismo `check: false`

**[PRUEBA]** (`s03-sshfail`, `s06-drop`) Detalle en `CURRENT-BEHAVIOR.md` §7.
Resumen:

- Avería **antes** de empezar: nota 0, `conn_status` puesto. Distinguible, pero
  solo desde `resume.json` y solo a nivel de alumno entero.
- Avería **a mitad** (`s06-drop`, contenedor parado durante la 2ª de 3
  comprobaciones): nota **33**, `conn_status: error`. Las comprobaciones 2 y 3
  figuran como `check: false`, igual que si el alumno las hubiera hecho mal. No
  hay forma, desde el informe, de saber cuáles no eran evaluables.

Consecuencia directa: la regla que la GUI aplica («nota 0 + `conn_status`
- = sin evaluar») **no puede** cubrir el caso de la avería a mitad, y por eso
la GUI conserva deliberadamente el 33. Está documentado en su `CLAUDE.md`:
«una nota superior a cero se conserva aunque el host esté caído».

**[PRUEBA]** Lo que sí funciona y hay que conservar: la guarda
`@result.exitcode < 0` de `expect2` impide que un `expect_none` apruebe con la
máquina apagada (`s04-none`).

---

## F-08 · La nota depende del idioma del equipo del profesor

**[PRUEBA]** (`c03-shell`) Mismo proyecto, dos entornos:

```
LANG=es_ES.UTF-8  -> 80
LC_ALL=C          -> 60
```

El `expect "x"` acertaba contra la palabra «e**x**iste» del mensaje de error de
`id` en español. En inglés el mensaje no lleva esa letra.

No es un caso rebuscado: comprobar servicios por el texto de `systemctl`, `ls` o
`apt` es el uso normal de Teuton, y esos mensajes están traducidos. Dos
profesores del mismo departamento con distinto `LANG` pueden dar notas distintas
al mismo examen, y ni el informe ni el config registran el `locale` con el que se
corrigió.

---

## F-09 · Exit codes inconsistentes según los metacaracteres del comando

**[PRUEBA]** (`c04-exit`) El mismo comando inexistente:

| Comando | exit code observado |
|---|---|
| `noexiste_abc` | 1 |
| `noexiste_abc $PWD` | 127 |
| `noexiste_abc \| cat` | 0 |

Causa **[CÓDIGO]**: `Open3.capture2e` con un único String delega en el shell
**solo si la cadena contiene metacaracteres**. Sin shell, el `ENOENT` se captura
en el `rescue` de `execute_local.rb:24` y se fija `exitcode = 1`. Con shell, el
código es el que dé `sh` (127) o el de la última orden de la tubería (0).

Un `expect_exit 127` acierta o falla según si el comando lleva un `$`. Y el
tercer caso es el peor: un comando que no existe devuelve **éxito**.

Por SSH no ocurre: ahí los códigos son los correctos (`s02-ssh`).

---

## F-10 · El manejador de errores revienta él mismo

**[PRUEBA]** Cualquier error al cargar el `start.rb` (`c08-badruby`,
`c13-skip` en 3.0.0) produce:

```
rainbow.rb:6:in `new': wrong number of arguments (given 1, expected 0) (ArgumentError)
  from lib/teuton.rb:46:in `rescue in require_dsl_and_script'
```

Causa **[CÓDIGO]**: `teuton.rb` usa `Rainbow.new("texto")`, pero `Rainbow` se usa
como método (`Rainbow("texto")`) y su `new` no admite argumentos. Está así en
2.10.6 (línea 42) y en 3.0.0 (línea 46).

El mensaje que el autor quiso escribir («Syntax Error! Reading file …») **no se
ve nunca**. Lo que ve el profesor es una traza de Rainbow que no tiene nada que
ver con su problema.

---

## F-11 · `tt_skip: true` aborta la ejecución (regresión de 3.0.0)

**[PRUEBA]** (`c13-skip`) Dos alumnos, el segundo con `tt_skip: true`.

| Versión | resultado |
|---|---|
| 2.10.6 | correcto: fila `S`, exit 0, informes completos |
| **3.0.0** | **exit 1**, traza, solo se escribe `case-01.json` |

Causa **[CÓDIGO]**, `case_manager/ext/report.rb:37`: llama
`Settings.letter(:skip)` cuando `Settings.letter` no acepta argumentos (devuelve
un Hash). El `ArgumentError` resultante se intenta informar por la ruta rota de
F-10, y de ahí la traza de Rainbow.

Dos conclusiones: la versión publicada como 3.0.0 tiene una regresión en una
función de uso normal, y la suite de 164 tests no la detecta.

---

## F-12 · Las claves SSH modernas tumban la ejecución entera

**[PRUEBA]** (`s11-key`) Con una clave RSA creada por `ssh-keygen` sin más
opciones (formato `OPENSSH`, el de por defecto desde OpenSSH 7.8):

```
net/ssh/authentication/ed25519_loader.rb:19: unsupported key type (NotImplementedError)
net-ssh requires: ed25519 (>= 1.2), bcrypt_pbkdf (>= 1.0)
```

Tras convertirla con `ssh-keygen -p -m PEM`, el mismo proyecto da **100**.

Dos agravantes:

1. Esos dos gems **no están en el gemspec** de Teuton y son extensiones nativas:
   sin `ruby-dev` no se pueden instalar (comprobado en este equipo).
2. `NotImplementedError` **no desciende de `StandardError`**, así que el
   `rescue => e` de `execute_ssh.rb:81` no lo captura. El error escapa del hilo y
   mata la ejecución completa (mecanismo de F-03).

**[PRUEBA]** La misma causa se dispara sin usar claves: basta con que el
`~/.ssh/known_hosts` del profesor tenga **una** entrada ed25519 (el formato por
defecto hoy). El primer intento de conexión de esta investigación murió así.
Hubo que aislar `HOME` para poder seguir.

---

## F-13 · Ejecuciones simultáneas se pisan los informes

**[PRUEBA]** (`s10-concurrent`) Tres `teuton run` del mismo proyecto a la vez:
los tres terminan con exit 0 y queda **un solo** juego de ficheros en
`var/<testname>/`. Sin bloqueo, sin aviso, gana el último.

Causa **[CÓDIGO]**: la ruta de salida se deriva solo de `tt_testname`, y cada
informe se escribe con `File.open(f, "w")`.

La GUI ya lo sufrió: dos escrituras solapadas dejan un JSON válido seguido de la
cola del otro proceso, y `JSON.parse` falla. Tiene un `parseFirstJsonValue`
propio para recuperarse.

---

## F-14 · `moodle.csv` sin librería CSV

**[PRUEBA]** (`c12-csv`) Con `tt_moodle_id: "=cmd|' /C calc'!A1"`:

```csv
MoodleID, TeutonGrade, TeutonFeedback
=cmd|' /C calc'!A1,100.0,"Filename: case-01. Date: ..."
```

El valor sale **crudo y sin comillas**: inyección de fórmulas en cualquier hoja
de cálculo que abra el fichero.

**[PRUEBA]** Segundo defecto, más probable en el aula: un `tt_moodle_id` con una
coma se parte en **dos filas** con la misma nota:

```csv
uno@x.com,100.0,"..."
dos@x.com,100.0,"..."
```

Es un comportamiento intencionado (`moodle_id.split(",")`), pero implica que una
coma accidental en un identificador pone la nota de un alumno en la fila de otro.

Causa **[CÓDIGO]**: `moodle_csv_formatter.rb:18` escribe con interpolación de
strings; la librería `csv` de Ruby no se usa en ninguna parte.

---

## F-15 · Sin reintentos

**[CÓDIGO]** No hay ninguna lógica de reintento en `execute_ssh.rb`,
`execute_local.rb` ni `execute_manager.rb`. Un fallo en el primer comando fija
`sessions[host] = :nosession` y **todos los comandos siguientes de ese alumno**
devuelven `TEUTON_ERROR_SSH_NO_CONNECTION` sin volver a intentar conectar.

**[PRUEBA]** (`s03-sshfail`, `s06-drop`) Confirmado: tras el primer fallo, la
segunda comprobación no reintenta; da directamente
`TEUTON_ERROR_SSH_NO_CONNECTION`.

Combinado con F-05, un pico de carga de 200 ms puede costarle el examen a un
alumno.

---

## F-16 · Cancelar no guarda nada

**[PRUEBA]** (`s05-hang`) Un `SIGINT` (Ctrl-C) o un `SIGTERM` durante la
ejecución termina con 130 / 143 y deja `var/<testname>/` **vacío**. No hay
manejador de señales ni escritura parcial: los informes se escriben todos al
final.

Consecuencia práctica: no existe «parar el examen y quedarnos con lo que hay».
O termina, o no hay notas.

---

## Comportamientos correctos que conviene no perder

**[PRUEBA]** Cosas que Teuton hace bien y que el sucesor debe replicar:

1. **La guarda de `exitcode < 0`**: un error de conexión nunca hace aprobar un
   `expect_none` (`s04-none`).
2. **La tabla CONN ERRORS y `conn_status`**: es la semilla correcta de la
   separación técnica/académica, aunque esté incompleta.
3. **Los códigos de salida por SSH son fiables** (`s02-ssh`).
4. **Reutilización de la sesión SSH** por host y caso: N comprobaciones, una
   conexión.
5. **El paralelismo** (2,29 s frente a 127 s con 100 alumnos).
6. **Exit code 1 en los fallos duros** (YAML ilegible, error de sintaxis,
   excepción). Los silenciosos son F-02 y F-06, que salen con 0.
7. **`teuton check`** como comprobación previa sin tocar las máquinas.
