# Formato declarativo: `examen.yaml` y `aula.yaml`

Idioma: **las claves del YAML van en español** (las lee el profesor, como
`alumnos:` o `peso:`). El JSON canónico y el código Go van en inglés.

---

## 1. Capacidades mínimas que necesita `examen.yaml`

Derivadas de E1 y E2 (`01-TRADUCCION-EXAMENES.md`), no de un catálogo teórico.

| # | Capacidad | Justificación |
|---|---|---|
| M-1 | Metadatos: `nombre`, `version` | Auditoría y hash del examen |
| M-2 | Declarar los **hosts lógicos** que el examen usa (`host1`, `host2`) | E2 y el examen de DHCP |
| M-3 | **Grupos** de comprobaciones con título | K-4; la GUI los usa |
| M-4 | Comprobación con `id` estable, `descripcion` y `peso` | K-3; el `id` permite comparar ejecuciones |
| M-5 | Comando como **vector de argumentos** + host lógico | C-1, elimina inyección y exit codes erráticos |
| M-6 | Aserción `contiene` (subcadena en stdout) | Es el 80 % del material real |
| M-7 | Aserción `igual_a` (stdout completo, recortado de espacios) | E1 y `systemctl is-active` |
| M-8 | Aserción `no_contiene` | K-7: la anticomprobación debe existir y no puede aprobar por avería |
| M-9 | Aserción `exit_code` | `ping`, `systemctl`, `dpkg-query` |
| M-10 | Aserción `cerca_de` (ancla + N líneas + contenido) | Sustituye `grep -A N`; 3 de 16 en E2 |
| M-11 | Comprobación **sin comando**: `valor:` contra un campo del inventario | E1 entero, sin shell |
| M-12 | **Sustitución** `${alumno.campo}` y `${host1.ip}` en argumentos y valores esperados | Cuestionarios y exámenes con datos por alumno |
| M-13 | `timeout` por comprobación (opcional, con valor por defecto) | C-3 |
| M-14 | Valores por defecto del examen (`por_defecto:`) para peso y timeout | Evita repetir 16 veces lo mismo |

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
- su `id`, su `grupo` ni su `peso`;
- el **denominador total**;
- el orden.

### Sintaxis: una sola forma

```yaml
cmd: ["getent", "passwd", "${alumno.usuario}"]
contiene: "${alumno.usuario}:x:"
```

Reglas de la sustitución, todas verificables en el PLAN:

1. Ámbitos válidos: `${alumno.<campo>}` (campos libres del inventario) y
   `${<host>.<ip|puerto|usuario>}` para los hosts declarados en M-2.
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
examen: "SMX2C · RA2 · Servicios de red (KEA + BIND)"
version: 3
hosts: [host1]

por_defecto:
  peso: 1
  timeout: 20s

grupos:
  - grupo: "Red y DHCP"
    comprobaciones:
      - id: red-ip-servidor
        descripcion: "El servidor tiene 10.0.0.1/8 en enp2s0"
        en: host1
        cmd: ["ip", "address", "show", "dev", "enp2s0"]
        contiene: "10.0.0.1/8"

      - id: kea-subnet
        descripcion: "KEA declara la subred 10.0.0.0/8"
        en: host1
        cmd: ["cat", "/etc/kea/kea-dhcp4.conf"]
        cerca_de:
          ancla: '"subnet"'
          lineas: 5
          contiene: "10.0.0.0/8"

      - id: kea-interfaz
        descripcion: "KEA escucha en enp2s0"
        en: host1
        cmd: ["cat", "/etc/kea/kea-dhcp4.conf"]
        contiene: "enp2s0"

      - id: kea-servicio
        descripcion: "El servicio kea-dhcp4 está activo"
        en: host1
        peso: 2
        cmd: ["systemctl", "is-active", "kea-dhcp4-server"]
        igual_a: "active"

  - grupo: "DNS"
    comprobaciones:
      - id: dns-forwarder
        descripcion: "Reenviador 9.9.9.9 configurado"
        en: host1
        cmd: ["cat", "/etc/bind/named.conf.options"]
        cerca_de: { ancla: "forwarders", lineas: 5, contiene: "9.9.9.9" }

      - id: dns-registro-alumno
        descripcion: "El alumno tiene su registro A en la zona directa"
        en: host1
        cmd: ["cat", "/etc/bind/forward.examen.local"]
        contiene: "${alumno.subdominio}"

      - id: dns-sin-recursion-abierta
        descripcion: "No se permite recursión desde cualquier origen"
        en: host1
        cmd: ["cat", "/etc/bind/named.conf.options"]
        no_contiene: "allow-recursion { any; }"

      - id: dns-activo
        descripcion: "named responde"
        en: host1
        timeout: 10s
        cmd: ["dig", "+short", "+time=3", "@127.0.0.1", "pc1.examen.local"]
        igual_a: "10.1.1.100"

  - grupo: "Cuestionario"
    comprobaciones:
      - id: q-puerto-https
        descripcion: "Puerto por defecto de HTTPS"
        valor: "${alumno.p1}"
        igual_a: "443"

      - id: q-mascara-24
        descripcion: "Máscara /24 en decimal"
        valor: "${alumno.p3}"
        igual_a: "255.255.255.0"
```

Peso total del ejemplo: 11. Idéntico para todos los alumnos, calculable sin
encender nada.

---

## 4. `aula.yaml` — ejemplo definitivo del MVP

```yaml
aula: "SMX2C 2026-27"
version: 2

# Valores comunes. Los hosts de cada alumno los heredan si no los redefinen.
comun:
  hosts:
    host1:
      puerto: 22
      usuario: "usuario"
      password_ref: "${AULA_PASSWORD}"     # referencia, nunca el valor
  timeouts:
    conexion: 10s
    alumno: 10m

alumnos:
  - id: alumne01
    nombre: "Ana Ferrer"
    moodle_id: "ana.ferrer@elpuig.xeill.net"
    hosts:
      host1: { ip: "192.168.1.20" }
    subdominio: "ana"
    p1: "443"
    p3: "255.255.255.0"

  - id: alumne02
    nombre: "Marc Oliva"
    moodle_id: "marc.oliva@elpuig.xeill.net"
    hosts:
      host1: { ip: "192.168.1.21", usuario: "marc" }
    subdominio: "marc"
    p1: "8443"
    p3: "255.255.255.0"

  - id: alumne03
    nombre: "Laia Puig"
    moodle_id: "laia.puig@elpuig.xeill.net"
    excluido: true                          # no se evalúa en esta pasada
    hosts:
      host1: { ip: "192.168.1.22" }
    subdominio: "laia"
    p1: "443"
    p3: "255.255.255.0"
```

Notas de diseño:

- `excluido: true` sustituye a `tt_skip`. El alumno aparece en el informe con
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
5. Referencia `${alumno.X}` a un campo que falta en algún alumno.
6. Comprobación sin ninguna aserción, o con dos aserciones incompatibles.
7. `peso` negativo. (`peso: 0` es legal: la comprobación se ejecuta, se informa
   y no entra en la nota.)
8. Contraseña literal en el inventario.
9. Inventario sin alumnos evaluables.

Cuando todo pasa, el PLAN publica: número de comprobaciones, peso total, hash
del examen, hash del inventario y lista de alumnos. Ese número es el que la GUI
ya no tendrá que adivinar (`c14-check`).

## 6. Lecturas compartidas de ficheros

Desde ADR-0028, `fichero: "/etc/kea/kea-dhcp4.conf"` es una alternativa a
`cmd` y `valor`: se elige exactamente una fuente. Requiere `en` y una ruta
absoluta resuelta, no vacía ni con caracteres nulos. Admite sustitución de
campos del alumno con las mismas restricciones de secretos que `cmd`.

Las comprobaciones del mismo alumno, host lógico y ruta literal comparten
una captura obtenida con `cat -- ruta` al primer uso. Deben tener el mismo
timeout efectivo; las diferencias se rechazan con fichero y línea antes de
SSH. No se agrupan hosts con nombres distintos ni se normalizan rutas.
Los comandos intermedios no renuevan la captura. Las correcciones, reintentos
y vueltas del modo examen obtienen capturas nuevas.

Se admiten `contiene`, `no_contiene`, `igual_a` y `cerca_de`; `exit_code` queda
para `cmd`. Una lectura completa que termina con exit no cero hace fallar
los requisitos de contenido con explicación y stderr. Los problemas técnicos
y los prefijos recortados conservan las políticas actuales. Cada requisito
mantiene su peso, aserción y evidencia; el detalle identifica la captura.
Los tiempos y contadores de una ejecución compartida describen esa captura:
no deben sumarse para contar operaciones remotas.
