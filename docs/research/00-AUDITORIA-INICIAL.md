# Sucesor de Teuton: corrector de exámenes prácticos sobre SSH

## Contexto

Teuton (Ruby, `teuton-software/teuton`) evalúa máquinas de alumnos ejecutando
comandos por SSH y puntuando la salida. **No está abandonado**: v3.0.0 es de
abril de 2026 y hay commits de agosto de 2026. Lo que sí hubo es un parón de
2023-11 a 2025-04.

La auditoría del núcleo (6.900 líneas Ruby) encuentra problemas estructurales,
no cosméticos:

| # | Problema | Dónde |
|---|---|---|
| 1 | Sin timeout de ejecución de comando. Un alumno con un proceso colgado bloquea el proceso del profesor indefinidamente | `execute_ssh.rb:52` |
| 2 | Un hilo y una sesión SSH por alumno, sin límite. 200 alumnos = 200 hilos | `check_cases.rb:48` + 3 sitios más |
| 3 | Contraseñas en texto plano en `config.yaml`, **y volcadas en todos los informes exportados** | `play.rb:46`, `execute_telnet.rb:55` |
| 4 | Salto por gateway roto en Linux (falta el binario `ssh` tras `sshpass`) y con la contraseña en `argv` | `execute_ssh.rb:33` |
| 5 | Inyección de comandos sistémica: sin `Shellwords` en todo el repo; `Open3.capture2e` con un único String | `execute_local.rb:21`, builtins |
| 6 | `method_missing` catch-all + `respond_to_missing? → true`: un typo en el DSL no es un error, es una nota silenciosamente incorrecta | `dsl/macro.rb:35` |
| 7 | Sin reintento: un glitch de red en el comando 1 de 80 suspende al alumno con 0 | `execute_ssh.rb:40` |
| 8 | `moodle.csv` escrito con interpolación de strings, sin la librería CSV: riesgo de fichero corrupto y de CSV injection en Moodle | `moodle_csv_formatter.rb:18` |
| 9 | Rutas de error que revientan con `NameError`/`ArgumentError`, sin cobertura de test | `config_file_reader.rb:115`, `settings.rb:2`, `upload.rb:19` |

Decisión tomada: **proyecto nuevo desde cero**, en **Go** (binario único, sin
runtime que instalar en el aula), tests en **YAML declarativo** (sin `eval`, sin
código ejecutable en el fichero de examen), autenticación por **claves SSH** con
contraseña opcional desde `.env.local`.

Resultado buscado: corregir el examen práctico de una clase entera con un solo
binario, un inventario y un fichero de test, en segundos y sin secretos en el
repositorio.

**Pendiente de decidir contigo:** el nombre. En el plan uso `arbiter`; cámbialo
antes de empezar si prefieres otro (el nombre solo aparece en el módulo Go, el
nombre del binario y el README).

---

## Diseño

### Modelo conceptual

Tres conceptos, nada más:

- **Inventario** (`aula.yaml`): quién es cada alumno y cómo se llega a su máquina.
- **Test** (`examen.yaml`): lista de comprobaciones, cada una con su peso.
- **Informe**: por alumno, qué pasó y qué nota sale.

Frente a Teuton, desaparecen: el DSL ejecutable, las macros, telnet, el salto
por gateway, los 7 formatos de salida paralelos, los alias de configuración y el
modo "monitorización de servidores".

### Estructura

```
arbiter/
  go.mod
  cmd/arbiter/main.go        # CLI: run, check, init
  internal/inventory/        # parseo de aula.yaml + carga de .env.local
  internal/testplan/         # parseo y validación de examen.yaml
  internal/runner/           # pool de workers, SSH, timeouts
  internal/assert/           # evaluación de las aserciones
  internal/report/           # terminal, JSON, CSV Moodle, HTML
  testdata/                  # ficheros de ejemplo + golden files
```

### Inventario — `aula.yaml`

```yaml
defaults:
  user: alumno
  port: 22
  key: ~/.ssh/aula_ed25519

alumnos:
  - id: amunoz
    moodle_id: "20314"
    host: 192.168.1.201
  - id: jlopez
    moodle_id: "20318"
    host: 192.168.1.202
    user: root            # sobrescribe defaults
```

Reglas:

- La resolución `alumno` → `defaults` se hace con punteros (`*string`), no por
  truthiness. Evita el bug de precedencia de `config.rb:24`.
- **Nunca hay contraseñas en este fichero.** Si una máquina necesita contraseña,
  se pone `password_env: PASS_JLOPEZ` y el valor se lee de `.env.local`, que va
  en `.gitignore`. Si la variable no existe, el alumno falla con un error claro,
  no con una nota 0 silenciosa.
- Orden de autenticación: agente SSH → fichero de clave → contraseña de entorno.

### Test — `examen.yaml`

```yaml
nombre: "SRX - Examen 1: usuarios y servicios"

checks:
  - nombre: "Existe el usuario 'profe'"
    cmd: ["id", "profe"]
    puntos: 2
    espera:
      contiene: ["uid=", "(profe)"]

  - nombre: "Apache arrancado y habilitado"
    cmd: ["systemctl", "is-enabled", "apache2"]
    puntos: 3
    espera:
      salida_exacta: "enabled"

  - nombre: "El puerto 22 NO está abierto al exterior"
    cmd: ["ss", "-lntp"]
    puntos: 1
    espera:
      no_contiene: ["0.0.0.0:22"]

  - nombre: "Hostname configurado"
    cmd: ["hostname"]
    puntos: 1
    espera:
      regex: "^srv-[a-z]+$"
```

Puntos clave del diseño:

- **`cmd` es una lista, no una cadena.** Se ejecuta sin shell. Esto elimina de
  raíz la clase entera de bugs de inyección de Teuton. Si alguna comprobación
  necesita pipes, se usa explícitamente `shell: "ss -lntp | grep 22"` y el
  parseo avisa de que ese campo no escapa nada.
- Aserciones soportadas (cerrado, sin extensiones): `contiene`, `no_contiene`,
  `salida_exacta`, `regex`, `codigo_salida`, `lineas_min`. Todas sobre
  stdout+stderr combinados.
- Campos opcionales por check: `timeout` (default 10 s), `en` (para tests
  multi-máquina, apunta a otra entrada del inventario).
- **Validación estricta al cargar**: campo desconocido = error de arranque, no
  silencio. `arbiter check examen.yaml` valida sin conectarse a nada.
- Sin `if`, sin variables, sin macros. Si un examen no cabe aquí, es señal de
  que el examen debe partirse, no de que falte una función en la herramienta.

### Ejecución

- **Pool de workers con límite** (`--jobs`, default 8). Un `errgroup` con
  semáforo, no un goroutine por alumno.
- **Tres niveles de `context` con timeout**: conexión (10 s), comando (el del
  check, default 10 s), alumno completo (default 5 min). Cualquiera que salte
  cierra la sesión y marca el resto de checks como no ejecutados, distinguibles
  de "fallado".
- **Una sesión SSH por alumno, reutilizada** para todos los checks; un `Session`
  nuevo por comando (requisito del protocolo).
- **Reintento**: 2 reintentos con backoff solo en fallos de red/conexión, nunca
  en aserciones fallidas. Resuelve el problema 7 de la tabla.
- **Host keys**: fichero `known_hosts` propio del proyecto con TOFU (confía la
  primera vez, avisa si cambia). Flag `--trust-new=false` para exigir claves ya
  conocidas. Nunca se desactiva la verificación en silencio.
- Un fallo de un alumno jamás aborta a los demás.

### Informes

- **Terminal** (default): una línea por alumno con nota y número de checks
  pasados; con `-v`, el detalle de cada check fallado con el comando y la salida
  real recortada.
- **`--csv nota.csv`**: formato de importación de Moodle, escrito con
  `encoding/csv` y con protección contra CSV injection (prefijo `'` en campos
  que empiezan por `= + - @`).
- **`--json informe.json`**: una estructura por alumno, para lo que quieras
  hacer después.
- **`--html informe/`**: un HTML por alumno, para devolvérselo como
  retroalimentación.
- **Redacción obligatoria**: contraseñas y claves nunca aparecen en ninguna
  salida. Test específico que lo verifica.

### Cálculo de nota

`nota = 10 * (suma de puntos de los checks pasados / suma de puntos totales)`,
redondeada a 2 decimales. Los checks no ejecutados por error de conexión cuentan
como no pasados, **pero el informe lo marca en rojo y aparte**, para que puedas
decidir a mano si repites el examen de ese alumno. No se inventan notas.

---

## Orden de trabajo

1. **Esqueleto y modelo de datos.** `go mod init`, structs de inventario y test
   plan, parseo YAML con `sigs.k8s.io/yaml` y validación estricta.
   Comando `arbiter check` funcionando. *(~1 h)*
2. **Runner SSH contra un solo host.** Conexión, ejecución de un comando,
   timeouts, known_hosts TOFU. *(~2 h)*
3. **Motor de aserciones** y cálculo de nota. Es código puro, con tests de tabla
   exhaustivos. *(~1 h)*
4. **Paralelismo y resiliencia**: pool, reintentos, aislamiento de fallos. *(~1 h)*
5. **Informes**: terminal, CSV Moodle, JSON, HTML. *(~2 h)*
6. **`arbiter init`**: genera un `aula.yaml` y un `examen.yaml` de ejemplo
   comentados, más `.gitignore` con `.env.local`. *(~30 min)*
7. **README** con un ejemplo completo de examen real. *(~30 min)*

Total estimado: **1-2 jornadas de trabajo**.

## Verificación

- **Tests unitarios** del parser, el motor de aserciones y el cálculo de nota
  (`go test ./...`). Incluye un test que confirma que ninguna contraseña aparece
  en ninguna salida.
- **Test end-to-end real**: se levanta un servidor SSH en proceso con
  `gliderlabs/ssh` dentro del propio test, con respuestas programadas. Cubre
  conexión, timeout, comando colgado, host caído a mitad de examen y reintento.
  Sin esto no se da nada por funcionando.
- **Prueba manual contra una VM** del aula antes de usarlo en un examen real:
  ejecutarlo con un alumno ficticio y comparar el informe con lo que hay en la
  máquina.
- **Contraste con Teuton**: portar uno de tus exámenes existentes y verificar
  que las notas coinciden.

## Fuera de alcance (explícitamente)

Telnet, salto por gateway, monitorización continua, envío de correo a los
alumnos, subida de ficheros por SFTP, macros y detección de copias entre
alumnos. Si alguna hace falta después, se añade entonces con un caso de uso real
delante.
