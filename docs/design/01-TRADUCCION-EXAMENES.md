# Traducción conceptual de dos exámenes reales

Fuente: exámenes reales del curso, no inventados.

| Alias | Ruta original | Perfil |
|---|---|---|
| **E1 · Cuestionario de redes** | `teuton-gui-v2/sandbox/examen-demo/` | Sencillo: 10 comprobaciones, sin máquinas, ejecución local |
| **E2 · Examen RA2 (KEA + BIND)** | `teuton-gui-v2/sandbox/prueba/dns/` | Avanzado: 16 comprobaciones por SSH, tuberías, `grep -A`, servicios |

Se ha revisado además `teuton-gui-v2/sandbox/prueba/start.rb` (DHCP servidor +
cliente, 14 comprobaciones sobre **dos** hosts) porque es el único material real
con `host1` y `host2`; sus construcciones están incorporadas a la tabla de E2.

Clasificación usada en cada construcción:

- **D** — traducción directa a YAML.
- **P** — necesita parametrización (sustitución de variables del alumno).
- **N** — necesita una primitiva declarativa nueva.
- **X** — no debería existir en el nuevo sistema.
- **S** — requeriría scripting: fuera del MVP.

---

## E1 · Cuestionario de redes (sencillo)

El examen es un cuestionario: las **respuestas del alumno están en el
`config.yaml`** (`p1: "443"`, `p2: "22"`, …) y el `start.rb` las compara con la
solución ejecutando `echo` **en la máquina del profesor**.

```ruby
target "P1. Puerto por defecto de HTTPS"
run "echo '#{get(:p1)}'"
expect "443"
```

| Construcción original | Clase | Traducción / decisión |
|---|---|---|
| `group "Cuestionario de redes"` | **D** | `grupo: Cuestionario de redes` |
| `target "P1. …"` | **D** | `- id: p1` + `descripcion:` |
| `run "echo '#{get(:p1)}'"` | **N** | **No debe haber comando.** Primitiva nueva `valor: "${alumno.p1}"`: la comprobación lee un campo del inventario y no ejecuta nada, ni local ni remoto |
| `expect "443"` | **D** | `igual_a: "443"` (aquí es igualdad exacta, no subcadena) |
| peso implícito 1 | **D** | `peso: 1` explícito |
| `play do show export end` | **X** | El motor siempre escribe su artefacto. No hay fase de salida programable |
| 11 alumnos con las 10 respuestas en `cases:` | **D** | `aula.yaml`, campos libres por alumno |

**Conclusión de E1.** Traducible entero, y **mejor** que el original: hoy el
examen ejecuta 10 `echo` con interpolación de datos del alumno en una cadena de
shell en el equipo del profesor — el vector exacto de `SECURITY.md` §4. La
primitiva `valor:` elimina el shell de este caso de uso, que es el más frecuente
en cuestionarios.

Ganancia secundaria: E1 deja de depender de que la máquina del profesor tenga
`echo`, `LANG` o cwd concretos.

---

## E2 · Examen RA2 (avanzado)

16 comprobaciones sobre `host1` por SSH, peso 1 cada una.

| Construcción original | Clase | Traducción / decisión |
|---|---|---|
| `run "ip address show dev enp2s0", on: :host1` | **D** | `cmd: ["ip", "address", "show", "dev", "enp2s0"]`, `en: host1` |
| `expect "10.0.0.1/8"` | **D** | `contiene: "10.0.0.1/8"` |
| `run "cat /etc/kea/kea-dhcp4.conf \| grep enp2s0"` | **D** | La tubería **desaparece**: `cmd: ["cat", "/etc/kea/kea-dhcp4.conf"]` + `contiene: "enp2s0"`. El filtrado lo hace el motor sobre stdout, no el shell del alumno |
| `run "systemctl status named \| grep 'active (running)'"` | **D** | `cmd: ["systemctl", "is-active", "named"]` + `igual_a: "active"`. Además elimina la dependencia del idioma (F-08) |
| `run "ping -c 1 -w 1 8.8.8.8 \| grep '1 packets'"` | **D** | `cmd: ["ping","-c","1","-w","1","8.8.8.8"]` + `exit_code: 0` |
| `run "grep '\"subnet\"' -A5 …"` + `expect "10.0.0.0/8"` | **N** | Aserción de **proximidad**: «el valor esperado aparece dentro de las N líneas siguientes a un ancla». Primitiva nueva `cerca_de: {ancla: …, lineas: 5, contiene: …}`. Son 3 de 16 comprobaciones de E2 y aparece también en el examen de DHCP: no es un caso raro |
| `run "apt show isc-dhcp-server"` + `expect "APT-Manual-Installed: yes"` | **D**, con aviso | `cmd: ["dpkg-query","-W","-f=${Status}","isc-dhcp-server"]` + `contiene: "install ok installed"`. `apt show` imprime texto traducido: es exactamente F-08 |
| `host1_username` / `host1_password` en `global:` | **D** con cambio | Van a `aula.yaml`, y la contraseña **solo como referencia** (`${AULA_PASSWORD}`) |
| `host1_ip` por alumno | **P** | `alumnos[].hosts.host1.ip` |
| Dos hosts (`host1`, `host2` del examen de DHCP) | **D** | `hosts:` declarado en el examen, resuelto por alumno en el inventario |
| `tt_members`, `tt_moodle_id` | **D** | `nombre`, `moodle_id` |
| `tt_skip` | **D** | `excluido: true` en el alumno (no altera el denominador de los demás) |
| `#send :copy_to => :host1` comentado | **X** | D-10 de `KEEP-DROP-CHANGE.md` |
| 14 `target` casi idénticos sobre ficheros de BIND | **D** hoy, **P** deseable | Se escriben los 16 a mano. Si algún día molesta, `para_cada:` con lista **declarada en el examen** (todos los alumnos obtienen las mismas N) |

**Conclusión de E2.** Traducible entero con **dos primitivas nuevas**
(`cerca_de`, y `exit_code` que ya estaba en el DSL como `expect_exit`) y ninguna
capacidad de scripting. Doce de las dieciséis mejoran al traducirse, porque la
tubería remota y los mensajes traducidos desaparecen.

---

## Lo que la traducción demuestra

1. **Ninguno de los dos exámenes reales usa bucles ni condicionales.** El caso
   `c14-check` de la investigación es una construcción de laboratorio, no una
   práctica del curso. El riesgo nº 1 de `PROPOSAL.md` §8 queda rebajado: el
   acantilado de expresividad no aparece en el material real.
2. **La tubería a `grep` es el idioma real del profesor**, y es complejidad
   accidental: lo que se quiere decir es «esto aparece en la salida». Se resuelve
   en el motor con `contiene:`, sin shell en la máquina del alumno.
3. **El único patrón que no se deja aplanar es `grep -A N`**, y merece primitiva
   propia porque comprueba estructura de fichero de configuración, que es
   literalmente el temario.
4. **El cuestionario no necesita ejecutar nada.** Descubrirlo evita arrastrar un
   transporte «local» al MVP solo para hacer `echo`.
5. **Nada del material real exige `if`, bucles, macros, `use`, telnet, pasarela
   ni envío de correo.** Todo lo que `KEEP-DROP-CHANGE.md` proponía eliminar se
   confirma sin uso real.

## Construcciones que quedan fuera del MVP (clase S)

Ninguna aparece en E1 ni en E2. Se listan para que la decisión sea explícita:

| Construcción | Por qué fuera |
|---|---|
| Comprobación cuyo resultado depende de otra (`if el servicio está activo, entonces…`) | Rompe el denominador fijo |
| Cálculo sobre la salida (sumas, parseo de JSON remoto, comparación numérica) | Requiere expresiones; `contiene`/`igual_a`/`exit_code`/`cerca_de` cubren el material real |
| Reutilización entre exámenes (`use`, macros) | Se resuelve copiando el fichero; si un día pesa, `incluye:` de otro YAML **sin** ejecución |
| Salida a Moodle, HTML, correo, SFTP | Pasos posteriores sobre el JSON canónico |
