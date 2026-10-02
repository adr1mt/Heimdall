# Secretos, salida, timeouts y reintentos

---

## 1. Secretos

### El principio

El secreto viaja **del almacén cifrado de la GUI al proceso del motor, por un
canal privado, y muere ahí**. No pasa por ningún fichero del proyecto, ningún
argumento, ningún log y ningún resultado.

```
GUI (Electron safeStorage · default-globals.enc)
 └─ descifra en memoria
     └─ escribe un sobre JSON en el stdin del motor y lo cierra
         └─ el motor lo guarda en memoria, lo usa al autenticar, y no lo imprime
```

### Formato del sobre (una sola línea JSON, seguida de EOF)

```json
{"schema":1,"secrets":{"AULA_PASSWORD":"…","AULA_KEY_PASSPHRASE":"…"}}
```

El motor se lanza con `--secrets=stdin`. Lee **una** línea, la parsea, pone el
buffer a cero y cierra stdin. Si `--secrets=stdin` está y no llega nada en 5 s,
aborta con error de configuración.

Un aula cuyas máquinas no piden ninguna contraseña manda el sobre igual, con
`secrets` vacío: `{"schema":1,"secrets":{}}`. Es una respuesta válida, no un
error. Quien decide si lo que ha llegado cubre lo que el PLAN necesita es
`engine.CheckSecrets`, en un solo sitio, y nombra cada referencia que falte. No
llegar **nada** por stdin sigue siendo error de configuración: son dos cosas
distintas.

### Por qué stdin y no las alternativas

| Vía | Veredicto |
|---|---|
| `argv` | **No.** Visible en `ps` para cualquier usuario del equipo. Es el defecto de `sshpass` (`SECURITY.md` §3) |
| Variable de entorno | Aceptable pero peor: se hereda a los hijos y aparece en volcados de diagnóstico. Se reserva para uso CLI |
| Fichero temporal | Toca el disco y hay que borrarlo de forma fiable. Más piezas, más fallos |
| **stdin** | **Sí.** No toca disco, no es visible desde fuera, muere con el proceso, y en Electron es una línea: `spawn(bin, args, {stdio:['pipe','pipe','pipe']})`, `child.stdin.end(JSON.stringify(sobre))` |

Nota de implementación: el NDJSON sale por **stdout**, así que stdin queda libre.
Si en el futuro el motor necesitase stdin interactivo, se pasa el sobre por un
descriptor extra (`stdio:['ignore','pipe','pipe','pipe']`, fd 3) sin cambiar
nada más.

### Uso CLI sin GUI

```bash
AULA_PASSWORD='…' heimdall run --secrets=env .
```

El motor lee **solo** las variables nombradas por las referencias del
`aula.yaml`. Una referencia sin variable definida es error de PLAN, no una
contraseña vacía.

### Dónde pueden aparecer referencias, y dónde no

- **Sí**: campos de autenticación del `aula.yaml` (`password_ref`,
  `passphrase_ref`).
- **No**: en `examen.yaml`, en ningún `cmd`, en ningún valor esperado. Un
  `${MAYUSCULAS}` fuera de un campo de autenticación es error de validación.

Esa regla es lo que hace la garantía **estructural** y no una heurística: si un
secreto no puede entrar en un comando, no puede salir en el resultado.

### Qué aparece en el artefacto

```json
"auth": { "method": "password", "secret_ref": "${AULA_PASSWORD}" }
```

La referencia, nunca el valor. Y como segunda línea de defensa (no como
mecanismo principal), el escritor pasa los valores conocidos por un filtro de
redacción antes de serializar: si alguna vez un secreto llega a `stderr` de un
comando del alumno, se sustituye por `«[oculto]»` y se añade un `Warning`.

---

## 2. stdout / stderr y límites

- **Separados siempre.** Nunca se mezclan (C-2, contra el `capture2e` y el
  `exec!` de Teuton).
- **Límite por flujo y comprobación: 64 kB.** Se conservan los **primeros** 64 kB
  y se marca `truncated: true`, con `bytes_total` real.
- **Corte duro del lector: 8 MB por flujo.** Pasado ese punto el motor deja de
  leer, cierra el canal, marca la comprobación `UNEVALUATED` / `OUTPUT_OVERFLOW`
  con `detail: "salida desbordada"` y añade un `Warning`. Protege contra el
  `cat` accidental de 300 MB que hoy pide 970 MB de RAM y mata la pasada entera
  (`PERFORMANCE.md` §2).
- Techo de memoria por alumno ≈ 2 flujos × 64 kB × comprobaciones en vuelo (1) =
  **128 kB**. Con 16 alumnos concurrentes, 2 MB. Plano respecto al tamaño de la
  salida, que es lo que hay que medir.
- El texto se guarda como UTF-8 válido; los bytes inválidos se sustituyen y se
  marca en el `Warning`. El corte se hace en frontera de runa, no a mitad.
- `bytes_total` cuenta los bytes recibidos, aunque no se conserve su contenido;
  al cortar la lectura no puede medir lo que no se llegó a recibir.

Los 64 KiB son evidencia conservada, no la salida completa. Si el prefijo no
prueba la aserción, queda UNEVALUATED / OUTPUT_OVERFLOW. Una coincidencia de
`contiene`/`cerca_de` o el texto prohibido de `no_contiene` sí permiten decidir.
`igual_a` no se decide sobre un flujo recortado (ADR-0025).
`bytes_total` cuenta lo recibido hasta EOF o hasta el corte duro, no los bytes
que el proceso pueda seguir generando después del cierre.

---

## 3. Timeouts

Cuatro relojes, semántica cerrada. La implementación completa (propagación de
`context.Context`) es del prototipo.

| Reloj | Por defecto | Qué mide | Resultado al vencer |
|---|---|---|---|
| **Conexión** | 10 s | Desde el TCP hasta la sesión SSH autenticada | La comprobación y todas las pendientes de ese host: `UNEVALUATED` / `CONNECT_FAILED`, `detail` con la fase |
| **Comprobación** | 20 s (configurable por comprobación) | Desde que se envía el comando hasta el exit status | Esa comprobación: `UNEVALUATED` / `TIMEOUT`. Las siguientes **se siguen intentando** |
| **Alumno** | 10 min | Todo el trabajo de un alumno | La comprobación en vuelo: `TIMEOUT`. Las que no empezaron: `NOT_RUN` con `detail` de presupuesto |
| **Cancelación** | — | El profesor para | En vuelo y pendientes: `CANCELLED`. Se escribe el artefacto con lo que haya |

No hay timeout global de ejecución separado: con presupuesto por alumno y
concurrencia acotada, el techo de la pasada ya está determinado, y un número más
sería otra cosa que ajustar. Se reconsiderará si el aula real lo desmiente.

### El proceso remoto que puede seguir vivo (D-1, cerrada)

Lo que SSH garantiza de verdad, y conviene no adornarlo:

- Cerrar el canal envía `channel close`. **No mata el proceso remoto.**
- Como el motor ejecuta `exec` **sin pty**, no hay terminal de control y el
  servidor **no envía `SIGHUP`**. El proceso queda huérfano reparentado a init,
  exactamente como el `sleep` de `s05-hang`.
- La petición `signal` del canal existe en el protocolo, pero **OpenSSH sshd no
  la implementa para canales `exec`**. No se puede confiar en ella.
- Pedir un pty para heredar el `SIGHUP` mezclaría stdout y stderr y metería
  secuencias de terminal en la salida. Es cambiar un problema por dos.

**Decisión.** El motor envuelve cada comando en `timeout` de coreutils cuando la
máquina del alumno lo tiene:

1. Al abrir la sesión, una vez por host: `command -v timeout`.
2. Si existe: el comando se lanza como
   `timeout -k 5s <N>s sh -c <supervisor fijo> heimdall-command <argv…>`.
   El supervisor invoca `"$@"` y emite un registro privado solo si no recibió TERM.
   Así un exit 124/137 propio no se confunde con el límite, ni un manejador TERM
   que devuelva 124 lo oculta. Terminación confirmada por timeout → KILLED_REMOTE.
   El shell local nunca interpreta argumentos; SSH los entrecomilla para el
   shell del servidor (ADR-0024).
3. Si no existe: se ejecuta tal cual, se registra un `Warning`
   `REMOTE_TIMEOUT_UNAVAILABLE` para ese host, y al vencer el timeout local →
   `remote_process: "UNKNOWN"`.
4. Al cancelar localmente o cuando la sesión se cae a mitad (`CONNECTION_LOST`),
   el estado es siempre
   `UNKNOWN`: no hay forma de saber qué pasó al otro lado.

`remote_process` tiene tres valores y `UNKNOWN` significa literalmente «puede
haber quedado un proceso corriendo en la máquina del alumno». Sale en el
artefacto y como `Warning`. La incertidumbre se publica, no se esconde.

---

## 4. Reintentos

**Política conservadora: solo se reintenta lo que con seguridad no se ejecutó.**

| Momento del fallo | ¿Reintento? | Resultado |
|---|---|---|
| Antes de enviar el comando — TCP, handshake, intercambio de claves, apertura del canal | **Sí**, hasta **2 reintentos** con espera de 1 s y 3 s más jitter | Si acaba bien: se ejecuta con normalidad y `connect_attempts` lo registra. Si no: `UNEVALUATED` / `CONNECT_FAILED` |
| Autenticación rechazada | **No.** Es determinista: la contraseña no va a cambiar en 3 s, y reintentar puede bloquear la cuenta o disparar `fail2ban` | `UNEVALUATED` / `AUTH_FAILED` |
| Después de enviar el comando — timeout, caída de conexión, EOF | **Nunca** | `UNEVALUATED` / `TIMEOUT` o `CONNECTION_LOST`, `command_attempts: 1` |
| Resultado desconocido (se envió, no se sabe si corrió) | **Nunca** | Igual que el anterior, y `remote_process: "UNKNOWN"` |
| Fallo académico (`FAIL`) | **Nunca** | Es el resultado, no un error |

Razón: un comando de examen puede tener efectos (arrancar un servicio, tocar un
fichero, consumir una concesión DHCP). Reejecutar sin saber si ya corrió puede
cambiar el estado de la máquina del alumno **durante el examen**. Mejor un
`UNEVALUATED` explícito, que el profesor resuelve reevaluando a ese alumno, que
una nota construida sobre una ejecución doble.

`command_attempts` existe en el modelo aunque en el MVP valga siempre 1: si algún
día se admiten reintentos de comandos marcados idempotentes, el campo ya audita
la diferencia. Un reintento invisible es otra forma de error silencioso (F-15).

### Concurrencia y reintentos

El reintento de conexión **no** es la solución a F-05 (53 ceros de 100 alumnos):
eso lo resuelve el tope de concurrencia. El reintento cubre el parpadeo real de
red del aula. Por defecto: **16 alumnos en vuelo**, y además **máximo 4 sesiones
simultáneas por host de destino** para el caso de varios alumnos contra un mismo
servidor. Ambos configurables. ADR-0013 cierra D-6 con mediciones del laboratorio;
el examen real de aula sigue pendiente en T084.
