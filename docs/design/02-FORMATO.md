# Formato declarativo: `examen.yaml` y `aula.yaml`

Idioma: **las claves del YAML y las referencias reservadas van en inglés**
(ADR-0042). No se admiten claves españolas ni mezclas. Los textos, los campos
libres del alumno y la ayuda docente pueden estar en español. `version` conserva
su función de revisión del documento; no selecciona un dialecto anterior.

---

## 1. Capacidades mínimas que necesita `examen.yaml`

Derivadas de E1 y E2 (`01-TRADUCCION-EXAMENES.md`), no de un catálogo teórico.

| # | Capacidad | Justificación |
|---|---|---|
| M-1 | Metadatos: `exam`, `version` | Auditoría y hash del examen |
| M-2 | Declarar los **hosts lógicos** que el examen usa (`host1`, `host2`) | E2 y el examen de DHCP |
| M-3 | **Grupos** de comprobaciones con título | K-4; la GUI los usa |
| M-4 | Comprobación con `id` estable, `description` y `weight` | K-3; el `id` permite comparar ejecuciones |
| M-5 | Comando como **vector de argumentos** + host lógico | C-1, elimina inyección y exit codes erráticos |
| M-6 | Aserción `contains` (subcadena en stdout) | Es el 80 % del material real |
| M-7 | Aserción `equals` (stdout completo, recortado de espacios) | E1 y `systemctl is-active` |
| M-8 | Aserción `not_contains` | K-7: la anticomprobación debe existir y no puede aprobar por avería |
| M-9 | Aserción `exit_code` | `ping`, `systemctl`, `dpkg-query` |
| M-10 | Aserción `near` (ancla + N líneas + contenido) | Sustituye `grep -A N`; 3 de 16 en E2 |
| M-11 | Comprobación **sin comando**: `value:` contra un campo del inventario | E1 entero, sin shell |
| M-12 | **Sustitución** `${student.campo}` y `${host1.ip}` en argumentos y valores esperados | Cuestionarios y exámenes con datos por alumno |
| M-13 | `timeout` por comprobación (opcional, con valor por defecto) | C-3 |
| M-14 | Valores por defecto del examen (`defaults:`) para peso, timeout y sudo | Evita repetir 16 veces lo mismo |
| M-15 | `sudo: true` por comprobación: el comando se ejecuta como administrador con la contraseña de la clase | Kea 3 en Ubuntu 26.04 deja `/etc/kea` solo a root; `nft list ruleset` también (ADR-0032) |

Y **nada más**. No hay `if`, ni bucles, ni expresiones, ni inclusión de ficheros
en el MVP.

### Capacidades que se rechazan explícitamente

| Rechazada | Motivo |
|---|---|
| `shell: true` o comandos como cadena | Reintroduce F-09, la inyección de `SECURITY.md` §4 y la dependencia del shell del alumno. El material real no lo necesita: la tubería se sustituye por la aserción |
| Expresiones regulares en las aserciones | Tentador, pero convierte el examen en código y hace ilegible el motivo de un suspenso. Si aparece una necesidad real, se evalúa entonces |
| Condicionales, aunque sean «seguros» | Es la causa de `c14-check`: dos alumnos, dos denominadores, la misma nota |

---

## 2. Política de parametrización (decisión cerrada)

**Principio.** El PLAN produce **exactamente la misma lista de comprobaciones,
los mismos ids y los mismos pesos para todos los alumnos**, antes de tocar
ninguna máquina.

### Puede variar por alumno

- los **argumentos** del comando;
- el **host** y el puerto donde se ejecuta;
- el **usuario** de conexión;
- el **valor esperado** de una aserción.

### No puede variar por alumno

- qué comprobaciones existen;
- su `id`, su `group` ni su `weight`;
- el **denominador total**;
- el orden.

### Sintaxis: una sola forma

```yaml
cmd: ["getent", "passwd", "${student.user}"]
contains: "${student.user}:x:"
```

Reglas de la sustitución, todas verificables en el PLAN:

1. Ámbitos válidos: `${student.<campo>}` (campos libres del inventario) y
   `${<host>.<ip|port|user>}` para los hosts declarados en M-2.
2. La sustitución ocurre **en un elemento del vector de argumentos o en un valor
   esperado, nunca en una cadena que vaya a un shell** — porque no hay shell.
3. **Referencia inexistente = error de validación**, no cadena vacía. Es la
   lección de F-02 aplicada a la parametrización.
4. Un campo de inventario ausente en **un solo alumno** también es error de
   validación del PLAN: o lo tienen todos, o no se usa.
5. El valor sustituido **nunca se interpreta**: entra tal cual como un argumento,
   con espacios, comillas o `;` incluidos, y ahí muere el vector de ataque.
6. **Los secretos no son sustituibles aquí.** `${AULA_PASSWORD}` solo es válido
   en los campos de autenticación del `aula.yaml` (ver `05-SECRETOS…`).

### Variantes de examen (lo que se hace en vez de condicionales)

Si dos grupos de alumnos deben examinarse de cosas distintas, se usan **dos
ficheros de examen**. El alumno lleva `variante: A`, y el informe publica el
hash del examen aplicado a cada uno. Dentro de una variante el denominador es
uniforme y a simple vista se ve si dos alumnos no compartieron examen.

No está en el MVP: el MVP acepta **un examen por ejecución**.

---

## 3. `examen.yaml` — ejemplo definitivo del MVP

```yaml
exam: "SMX2C · RA2 · Servicios de red (KEA + BIND)"
version: 3
hosts: [host1]

defaults:
  weight: 1
  timeout: 20s

groups:
  - group: "Red y DHCP"
    checks:
      - id: red-ip-servidor
        description: "El servidor tiene 10.0.0.1/8 en enp2s0"
        on: host1
        cmd: ["ip", "address", "show", "dev", "enp2s0"]
        contains: "10.0.0.1/8"

      - id: kea-subnet
        description: "KEA declara la subred 10.0.0.0/8"
        on: host1
        cmd: ["cat", "/etc/kea/kea-dhcp4.conf"]
        near:
          anchor: '"subnet"'
          lines: 5
          contains: "10.0.0.0/8"

      - id: kea-interfaz
        description: "KEA escucha en enp2s0"
        on: host1
        cmd: ["cat", "/etc/kea/kea-dhcp4.conf"]
        contains: "enp2s0"

      - id: kea-servicio
        description: "El servicio kea-dhcp4 está activo"
        on: host1
        weight: 2
        cmd: ["systemctl", "is-active", "kea-dhcp4-server"]
        equals: "active"

  - group: "DNS"
    checks:
      - id: dns-forwarder
        description: "Reenviador 9.9.9.9 configurado"
        on: host1
        cmd: ["cat", "/etc/bind/named.conf.options"]
        near: { anchor: "forwarders", lines: 5, contains: "9.9.9.9" }

      - id: dns-registro-alumno
        description: "El alumno tiene su registro A en la zona directa"
        on: host1
        cmd: ["cat", "/etc/bind/forward.examen.local"]
        contains: "${student.subdominio}"

      - id: dns-sin-recursion-abierta
        description: "No se permite recursión desde cualquier origen"
        on: host1
        cmd: ["cat", "/etc/bind/named.conf.options"]
        not_contains: "allow-recursion { any; }"

      - id: dns-activo
        description: "named responde"
        on: host1
        timeout: 10s
        cmd: ["dig", "+short", "+time=3", "@127.0.0.1", "pc1.examen.local"]
        equals: "10.1.1.100"

  - group: "Cuestionario"
    checks:
      - id: q-puerto-https
        description: "Puerto por defecto de HTTPS"
        value: "${student.p1}"
        equals: "443"

      - id: q-mascara-24
        description: "Máscara /24 en decimal"
        value: "${student.p3}"
        equals: "255.255.255.0"
```

En Ubuntu 26.04 con Kea 3, `/etc/kea` solo lo lee root: las dos comprobaciones
de `kea-dhcp4.conf` llevarían `sudo: true` (§3.1).

Peso total del ejemplo: 11. Idéntico para todos los alumnos, calculable sin
encender nada.

### 3.1 `sudo`

```yaml
      - id: kea-subnet
        on: host1
        sudo: true
        cmd: ["cat", "/etc/kea/kea-dhcp4.conf"]
        contains: "10.0.0.0/8"
```

- `sudo: true` o `sudo: false`, en la comprobación o en `defaults:` (lo
  heredan solo las comprobaciones con `cmd:`; una puede decir `sudo: false`).
- El motor ejecuta `sudo -S -p '' -- <cmd…>` y escribe por la entrada estándar
  la contraseña de ese host (la de su `password_ref`), la misma de la conexión.
  Nunca va en `argv`, en el examen ni en el artefacto. El comando recibe
  `/dev/null` como entrada: no puede leer la contraseña.
- El artefacto muestra el `cmd` del examen, sin `sudo`. El hash del PLAN
  incluye `sudo` solo cuando es `true`.
- Escribir `sudo` o una contraseña dentro de `cmd` sigue estando prohibido de
  hecho: la contraseña sería texto del examen (ADR-0009).
- Si sudo no arranca el comando (contraseña no aceptada, usuario que no puede
  usar sudo, máquina sin sudo), la comprobación es `UNEVALUATED` con causa
  `AUTH_FAILED` y el motivo; no se vuelve a pedir sudo en ese host para ese
  alumno. Nunca es `FAIL` (ADR-0032).

---

## 4. `aula.yaml` — ejemplo definitivo del MVP

```yaml
classroom: "SMX2C 2026-27"
version: 2

# Valores comunes. Los hosts de cada alumno los heredan si no los redefinen.
common:
  hosts:
    host1:
      port: 22
      user: "usuario"
      password_ref: "${AULA_PASSWORD}"     # referencia, nunca el valor
  timeouts:
    connect: 10s
    student: 10m

students:
  - id: alumne01
    name: "Ana Ferrer"
    moodle_id: "ana.ferrer@elpuig.xeill.net"
    hosts:
      host1: { ip: "192.168.1.20" }
    subdominio: "ana"
    p1: "443"
    p3: "255.255.255.0"

  - id: alumne02
    name: "Marc Oliva"
    moodle_id: "marc.oliva@elpuig.xeill.net"
    hosts:
      host1: { ip: "192.168.1.21", user: "marc" }
    subdominio: "marc"
    p1: "8443"
    p3: "255.255.255.0"

  - id: alumne03
    name: "Laia Puig"
    moodle_id: "laia.puig@elpuig.xeill.net"
    excluded: true                          # no se evalúa en esta pasada
    hosts:
      host1: { ip: "192.168.1.22" }
    subdominio: "laia"
    p1: "443"
    p3: "255.255.255.0"
```

Notas de diseño:

- `excluded: true` sustituye a `tt_skip`. El alumno aparece en el informe con
  estado `EXCLUDED`, sin nota y **sin alterar el denominador de los demás**.
- Los campos libres (`subdominio`, `p1`, `p3`) son datos del alumno y solo se
  usan por sustitución. K-1 intacto.
- **Ninguna contraseña literal.** Si el validador encuentra un campo
  `password:` con valor, el PLAN falla: es un error, no un aviso.
- Dos ficheros, como K-12 y el editor de la GUI esperan.

---

## 5. Qué valida el PLAN antes de tocar una máquina

Todo esto es error duro, con fichero y línea, y **exit code de configuración
inválida** (F-02, F-06, C-14):

1. Clave desconocida en cualquiera de los dos ficheros.
2. `id` de comprobación duplicado o ausente.
3. Host lógico usado en una comprobación pero no declarado en `hosts:`.
4. Host lógico declarado en el examen sin datos para algún alumno.
5. Referencia `${student.X}` a un campo que falta en algún alumno.
6. Comprobación sin ninguna aserción, o con dos aserciones incompatibles.
7. `weight` negativo. (`weight: 0` es legal: la comprobación se ejecuta, se informa
   y no entra en la nota.)
8. Contraseña literal en el inventario.
9. Inventario sin alumnos evaluables.
10. `sudo` que no es `true`/`false`, `sudo: true` en una comprobación sin `cmd:`,
    o `sudo: true` en un host sin `password_ref` para algún alumno.

Cuando todo pasa, el PLAN publica: número de comprobaciones, peso total, hash
del examen, hash del inventario y lista de alumnos. Ese número es el que la GUI
ya no tendrá que adivinar (`c14-check`).

## Comprobador cerrado del examen RA1 (ADR-0036)

`checker:` es alternativa a `cmd:` y `value:`. Su lista contiene exactamente
seis textos: `ra1-dhcp`, SHA-256 de la revisión del programa fijo del motor,
criterio conocido, interfaz externa, interfaz interna e IP de examen. No hay
código del profesor, rutas de scripts ni expresiones en ese campo. El examen
mantenido en [exams/ra1-dhcp-kea](../../exams/ra1-dhcp-kea/README.md) contiene la
revisión correcta. El PLAN rechaza otra revisión antes de abrir conexiones.

Se aplican `on:`, `sudo:`, `weight:` y `timeout:` como en un comando. Las tres
últimas posiciones permiten las referencias habituales del alumnado y hosts.
La aserción es obligatoriamente `equals: OK`; una respuesta académica del
programa es OK o FAIL. Cualquier otra respuesta, dependencia o permiso ausente
es un error técnico sin nota final, no un suspenso. Los comandos ordinarios
conservan sus reglas, sin códigos de salida técnicos añadidos de forma global.

El artefacto registra el perfil, la revisión y argumentos con el identificador
`heimdall:checker`. Esa revisión identifica el programa incorporado sin
repetir su fuente por alumno. El informe individual sigue publicando solo la
descripción y el resultado. El alcance semántico y sus límites están en la
documentación privada del examen.

T207 amplía únicamente la lista cerrada de criterios con `kea-reserves`:
comprueba conjuntamente las cuatro parejas MAC/IP del examen. Es una única
aserción; si falta o es incorrecta alguna reserva, no obtiene el peso del criterio.
Los criterios individuales históricos siguen disponibles en el programa fijo.
