# Teuton actual: comportamiento observado

Cada afirmación lleva su marca:

- **[PRUEBA]** confirmado ejecutando Teuton. El proyecto que lo demuestra está
  en `evidence/proyectos/`.
- **[CÓDIGO]** inferido leyendo el código, sin prueba que lo aísle.

Versiones examinadas: gem **2.10.6** (la instalada, la que usa la GUI) y
**3.0.0** (HEAD del repositorio). Donde difieren, se dice.

---

## 1. Arquitectura

**[CÓDIGO]** 93 ficheros Ruby, 4.871 líneas en `lib/`. El flujo es lineal:

```
bin/teuton -> CLI (Thor) -> Teuton.run -> require del start.rb del profesor
   -> el start.rb invoca group/play del DSL global (case_manager/dsl.rb)
   -> CaseManager#play -> check_cases! -> un Case por fila de config.yaml
      -> Case#play -> instance_eval de cada bloque group
         -> DSL run/goto -> ExecuteManager -> ExecuteLocal | ExecuteSSH | ExecuteTelnet
         -> DSL expect* -> Report#lines
   -> Report#close calcula la nota -> Formatter escribe var/<testname>/
```

Piezas con nombre propio:

| Pieza | Fichero | Qué hace |
|---|---|---|
| CLI | `cli.rb` | Thor. `new`, `check`, `config`, `readme`, `run`/`play`, `version` |
| Lectura de config | `utils/config_file_reader.rb` | YAML o JSON, claves a símbolos |
| Estado global | `utils/project.rb` | singleton con opciones, grupos, macros |
| Caso (alumno) | `case/case.rb` + `case/play.rb` | un alumno = un `Case` |
| Ejecución | `case/execute/*` | local (Open3), ssh (net-ssh), telnet |
| Aserciones | `case/dsl/expect*.rb` | `expect`, `expect_any/none/one/first/last`, `expect_exit/ok/fail`, `expect_sequence` |
| Nota | `report/report.rb#close` | `grade = round(100 * good_weight / max_weight)` |
| Salidas | `report/formatter/**` | txt, html, json, xml, yaml, colored_text, moodle_csv |

### El modelo de datos que llega al informe

**[PRUEBA]** (`c01-normal`) Cada comprobación produce este objeto en
`case-NN.json`:

```json
{"target_id":"01","check":true,"score":1.0,"weight":1.0,
 "description":"exit 0 + stdout","conn_type":"local","duration":0.001,
 "command":"echo HELLO_STDOUT","output":"HELLO_STDOUT",
 "alterations":"find(HELLO_STDOUT) & count","expected":"Greater than 0","result":1}
```

Y el caso cierra con:

```json
"results":{"case_id":"01","start_time":"...","finish_time":"...","duration":0.007,
 "unique_fault":0,"max_weight":26.0,"good_weight":16.0,"fail_weight":10.0,
 "fail_counter":1,"grade":62}
```

Tres cosas importantes de esa forma:

1. **`check` es booleano.** No hay ningún campo de estado técnico por
   comprobación. Un fallo de red y una respuesta incorrecta son el mismo
   `check: false`.
2. **`output` no es la salida.** Es la primera línea si hay 0 o 1 líneas, y el
   literal `"(N lines)"` si hay más. La salida real **nunca** se guarda.
   **[PRUEBA]** `s04-none` produce `"output":"(20 lines)"`.
3. **`result` es polimórfico.** Con `expect_exit` es el código de salida; con
   `expect "texto"` es el **número de coincidencias**; con `expect_first` es la
   primera línea. El mismo campo, tres tipos y tres significados, sin
   discriminante. **[PRUEBA]** `c01-normal`: el target 01 da `result: 1`
   (coincidencias) y el 03 da `result: 3` (exit code).

---

## 2. CLI y configuración

**[PRUEBA]** Subcomandos: `new`, `check`, `config`, `readme`, `run`/`play`,
`version`, `help`. Opciones de `run`: `--export=FORMATO`, `--cname=NOMBRE`,
`--cpath=RUTA`, `--case=1,2,3`, `--color`, `--quiet`.

**[PRUEBA]** `teuton FOO` sin subcomando equivale a `teuton run FOO`
(`method_missing` en `cli.rb:108`).

**[PRUEBA]** El directorio de salida se resuelve contra el **cwd del proceso**,
no contra el directorio del proyecto: `var/<tt_testname>` o `tt_outdir`. Por eso
la GUI lanza siempre con `cwd = proyecto` y ruta `.`.

**[PRUEBA]** Formatos de exportación en 2.10.6: `colored_text, html, json, txt,
xml, yaml`. `markdown` **no** existe en 2.10.6 (avisa y cae a `txt`) pero sí en
3.0.0. Además, `moodle.csv` se escribe **siempre**, se pida o no.

**[PRUEBA]** Los formatos se dividen en dos familias: `case-NN.*` (detalle por
alumno) y `resume.*` (la clase). No llevan la misma información: ver
`GUI-CONTRACT.md` §2.

---

## 3. El DSL

**[CÓDIGO]** `start.rb` es Ruby ejecutado con `require_relative` y luego
`instance_eval` dentro de cada `Case`. No hay sandbox: el fichero de examen
puede hacer cualquier cosa que pueda hacer Ruby.

Vocabulario: `group`/`task`, `target`/`goal`, `run`/`goto`/`on`, `expect*`,
`weight`, `get`/`set`, `use`, `define_macro`/`macro`, `unique`, `send`,
`upload`, `run_script`, `readme`, `play`/`start`, `show`, `export`.

### El DSL es Turing-completo, y eso cambia la nota

**[PRUEBA]** (`c14-check`) Este `start.rb`:

```ruby
group "dinamico" do
  3.times { |i| target "bucle #{i}"; run "echo L#{i}"; expect "L#{i}" }
  if _nivel.to_i > 2
    target "condicional"; run "echo COND"; expect "COND"
  end
end
```

con dos alumnos, uno con `nivel: 3` y otro con `nivel: 1`, produce:

| Alumno | targets | max_weight | nota |
|---|---|---|---|
| alumno-nivel3 | 4 | 4.0 | **100** |
| alumno-nivel1 | 3 | 3.0 | **100** |

Dos exámenes distintos, la misma nota, y nada en el informe indica que se les
haya examinado de cosas diferentes. Esto no es un fallo: es lo que el DSL
permite por construcción.

Corolario **[PRUEBA]**: `teuton check` sobre ese mismo proyecto declara
`Targets | 3`, y la ejecución real produce 4. Ningún análisis estático puede
acertar sobre un lenguaje completo. La barra de progreso de la GUI depende de
ese número (ver `GUI-CONTRACT.md` §4).

---

## 4. Ejecución local

**[CÓDIGO]** `ExecuteLocal` usa `Open3.capture2e(cmd)` con un único String.

Consecuencias, todas **[PRUEBA]** (`c03-shell`, `c04-exit`):

1. **stdout y stderr se mezclan** en un único flujo, sin distinguirse.
   `echo ONLY_STDERR >&2` da `output: "ONLY_STDERR"` y `check: true`.
2. **El shell se usa o no según el contenido de la cadena.** Ruby lanza el
   comando directamente si no hay metacaracteres, y por `sh -c` si los hay. El
   mismo comando inexistente da tres códigos de salida distintos:

   | Comando | exit code |
   |---|---|
   | `noexiste_abc` | **1** (`Errno::ENOENT` capturado, salida `"No such file or directory - ..."`) |
   | `noexiste_abc $PWD` | **127** (lo da `sh`) |
   | `noexiste_abc \| cat` | **0** (el de la tubería) |

3. **Hay inyección de comandos.** `run "echo usuario_" + _user_input` con
   `user_input: "pepe; touch /tmp/TEUTON_INJECTED_PWNED"` en el `config.yaml`
   creó el fichero **en la máquina del profesor**. No hay `Shellwords` en todo
   el repositorio.
4. **El cwd es el del proceso**, no el del proyecto: `run "echo *"` listó el
   directorio desde el que se lanzó `teuton`.

### La nota depende del idioma del equipo del profesor

**[PRUEBA]** (`c03-shell`) Una comprobación `run "id -u INTERPOLATED"` +
`expect "x"` aprueba en español (el mensaje de error es «no e**x**iste ese
usuario») y suspende en inglés («no such user»):

```
LANG=es_ES.UTF-8  -> nota 80
LC_ALL=C          -> nota 60
```

Mismo examen, mismo alumno, misma máquina, **20 puntos de diferencia**. Todo
`expect` que caiga sobre un mensaje de error del sistema es rehén de la
configuración regional del corrector.

---

## 5. SSH

**[CÓDIGO]** `ExecuteSSH` abre una `Net::SSH.start` por host y la cachea en el
`Case`, con `timeout: 30` (solo conexión), `keepalive: true` y
`non_interactive: true`.

**[PRUEBA]** (`s02-ssh`) Lo que funciona bien:

- Códigos de salida remotos **correctos**: `true` da 0, `exit 3` da 3, comando
  inexistente da 127.
- stdout y stderr **también se mezclan** aquí (`exec!` de net-ssh los une).
- Reutilización de la sesión: N comandos, una sola conexión SSH por host.

**[PRUEBA]** (`s01-ssh`) Lo que rompe en silencio: **cualquier host con IP
`127.0.0.x` o `localhost` se ejecuta en la máquina del profesor**, no por SSH.
Con `host1_ip: 127.0.0.1` y `run "whoami", on: :host1`, la respuesta fue
`adr1` (el profesor) y no `alumno` (el contenedor). El informe lo registra como
`conn_type: "local"` y no avisa de nada. Ver F-01.

**[PRUEBA]** (`s11-key`) La autenticación por clave pública **solo funciona con
claves en formato PEM heredado**. Una clave RSA recién creada por
`ssh-keygen` (formato `OPENSSH`, el de por defecto) hace que net-ssh 7.3.3 lance
`NotImplementedError`. Tras `ssh-keygen -p -m PEM`, la misma clave funciona y da
100. Ver F-12.

**[CÓDIGO]** El salto por pasarela (`hostN_route`) reescribe el comando como
`"sshpass -p #{password} #{user}@#{ip} #{command}"`: sin el binario `ssh` tras
`sshpass`, así que en Linux no puede funcionar, y con la contraseña en `argv`,
visible en el `ps` de cualquier usuario del equipo.

---

## 6. Evaluación y nota

**[CÓDIGO]** `Report#close`:

```ruby
max += i[:weight] if i[:weight].positive?
i[:check] ? good += i[:weight] : (fails += i[:weight]; fail_counter += 1)
grade = (100.0 * good / max).round      # 0 si max es 0
grade = 0 if unique_fault > 0
```

**[PRUEBA]** (`c01-normal`) 8 comprobaciones, pesos 1x6 + 10 + 10 = 26, 16
puntos buenos, `grade: 62`. La nota es siempre un **entero 0-100**.

**[CÓDIGO]** El denominador lo forman **solo las comprobaciones que llegaron a
registrarse**. Una comprobación que no se ejecuta no resta: desaparece. Ese es
el mecanismo de F-02.

**[PRUEBA]** (`s04-none`) Protección que sí existe y merece conservarse:
`expect2` fuerza `check: false` cuando `result.exitcode < 0`, que es el valor que
dejan los errores de conexión. Gracias a eso un `expect_none "intruso"` sobre un
alumno inaccesible **no aprueba**. Sin esa guarda, una máquina apagada daría
puntos.

### La columna STATE no es un estado técnico

**[CÓDIGO]** (`case_manager/ext/report.rb:46-48`)

```ruby
line[:letter] = CRUZ        if c.grade.zero?
line[:letter] = INTERROGA   if c.grade < 50.0     # pisa la anterior
line[:letter] = VISTO       if c.grade.to_i == 100
```

**[PRUEBA]** Es una banda de nota, nada más. Un alumno con un 33 legítimo sale
con `?` (`c02-fail`) y un alumno con la máquina apagada también (`s03-sshfail`).
La constante se llama `error:` en `settings.rb`, lo que invita a leerla como
estado técnico. No lo es.

---

## 7. Errores de conexión: lo que Teuton sí hace

**[PRUEBA]** (`s03-sshfail`) Cuatro alumnos, cuatro averías distintas:

| Alumno | `conn_status` | nota | `output` de la 1ª comprobación |
|---|---|---|---|
| password incorrecta | `error_authentication_failed` | 0 | `TEUTON_ERROR_SSH_AUTH_FAILED` |
| host inalcanzable (10.255.255.1) | `error` | 0 | `TEUTON_ERROR_SSH` |
| puerto cerrado | `error` | 0 | `TEUTON_ERROR_SSH` |
| usuario inexistente | `error_authentication_failed` | 0 | `TEUTON_ERROR_SSH_AUTH_FAILED` |

En terminal aparece una tabla **CONN ERRORS**, y `resume.json` lleva
`conn_status` por alumno. Eso es real y es lo mejor que tiene Teuton en este
terreno.

Sus tres límites, todos **[PRUEBA]**:

1. **Cuatro averías, dos etiquetas.** `error` es un cajón que mezcla timeout,
   conexión rechazada, DNS, IOError y cualquier otra cosa.
2. **`conn_status` solo está en `resume.json`.** El `case-NN.json` del alumno no
   lo lleva. Quien lea el detalle de un alumno no sabe si hubo avería.
3. **La nota sigue siendo 0**, indistinguible de quien no hizo nada. Y si la
   avería llega a mitad, la nota es peor aún: en `s06-drop` (conexión cortada
   durante la 2ª de 3 comprobaciones) el alumno se quedó con un **33**, con
   `conn_status: error` pero sin forma de saber qué comprobaciones eran
   técnicamente inválidas.

**[PRUEBA]** Las líneas de `logs` del `case-NN.json` llevan **códigos de escape
ANSI crudos** (`[41m` alrededor de la palabra ERROR). Quien consuma el
JSON tiene que limpiarlos.

**[CÓDIGO]** No hay reintentos en ninguna parte. Un parpadeo de red en la
comprobación 1 de 80 suspende al alumno.

---

## 8. Concurrencia

**[CÓDIGO]** `run_all_cases` crea **un `Thread` por alumno, sin límite**
(`ext/check_cases.rb:48`), y lo mismo el cierre de informes y la exportación.
Con `tt_sequence: true` se ejecutan en serie.

**[PRUEBA]** (`s09-scale`, 100 alumnos x 3 comprobaciones, una de 1 s):

| Modo | tiempo | RSS |
|---|---|---|
| paralelo | **2,29 s** | 161 MB |
| secuencial | **127,36 s** | 152 MB |

El paralelismo es el motivo por el que Teuton es usable, y no es negociable.

**[PRUEBA]** Dos `teuton run` simultáneos del mismo proyecto **se pisan**: los
tres procesos escriben sobre el mismo `var/<testname>/`, sin bloqueo ni aviso, y
sobrevive el último. La GUI tiene una defensa propia contra esto
(`parseFirstJsonValue`) porque el solapamiento deja un JSON válido seguido de la
cola del otro proceso.

---

## 9. Suite de tests de Teuton

**[PRUEBA]** 96 tests rápidos en 0,74 s; 164 en total en 11,86 s; 100 % en
verde en ambas versiones. Los 68 lentos (`test/command/slow_*`) lanzan el
binario como subproceso.

Lo que la suite **no** cubre, y por eso los fallos de este informe sobreviven:
la ruta `tt_skip` en el informe (que está **rota en 3.0.0**, F-11), el manejador
de errores de `teuton.rb` (que revienta él mismo, F-10), la ejecución SSH y
cualquier escenario de avería.
