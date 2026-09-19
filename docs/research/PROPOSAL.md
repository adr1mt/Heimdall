# Propuesta del sucesor

Todo este documento es **[PROPUESTA]**. Las referencias `F-nn` y los nombres de
proyecto (`s09-scale`, `c14-check`, …) apuntan a hechos comprobados en los demás
documentos.

---

## 1. Contraste con la dirección preliminar

Ninguna decisión se acepta porque estuviera en la lista. Veredicto de cada una:

| Decisión | Veredicto | Evidencia |
|---|---|---|
| Motor nuevo en Go | **Confirmada, no medida** | No hay Go en este equipo. La justificación es de despliegue y control, no de velocidad |
| Binario único | **Confirmada** | La GUI tiene `gemBinDirs()` + `bash -lc command -v teuton` + ruta manual en Ajustes solo para encontrar un gem |
| SSH nativo | **Confirmada, con una decisión abierta** | F-12: la gestión de claves de net-ssh es el fallo más tonto y más letal que hay. Ver §6, D-2 |
| Concurrencia limitada | **Confirmada, y es urgente** | F-05: 53 ceros de 100 alumnos provocados por el propio motor |
| Timeouts y cancelación | **Confirmada, y es lo primero** | F-04 + F-16: hoy cuelga para siempre y al matarlo no queda nada |
| Tests declarativos YAML | **Confirmada, con matiz importante** | F-02 y `c14-check`. Pero hay un acantilado de expresividad: ver §5 |
| Sin DSL Ruby ejecutable en el MVP | **Confirmada** | Es la raíz de F-02 y del denominador variable por alumno |
| Estados técnicos separados | **Confirmada, pero hace falta más grano** | F-07: por alumno no basta; `s06-drop` da un 33 que nadie puede interpretar |
| Protocolo JSON/NDJSON para la GUI | **Confirmada, pero no lo primero** | Ver §7: hay un orden de migración que reduce mucho el riesgo |
| GUI adaptada, no reescrita | **Confirmada sin reservas** | 192 + 40 tests en verde; el acoplamiento son 11 puntos |
| Fiabilidad de la nota como prioridad | **Confirmada** | Es lo que fallan F-01, F-02, F-06, F-08 y F-09, todos en silencio |

### Lo que sí hay que corregir de la lista

1. **«Estados técnicos separados de resultados académicos» se queda corto tal
   como está enunciado.** Teuton **ya** separa algo (`conn_status` por alumno) y
   aun así produce el 33 de `s06-drop`. La separación tiene que ser **por
   comprobación**, y el estado académico debe tener un valor que **no entre en la
   nota** (`UNEVALUATED`). Si no, se reconstruye el mismo problema con nombres
   nuevos.

2. **La taxonomía propuesta (`PASS FAIL ERROR TIMEOUT NOT_RUN CANCELLED`) mezcla
   dos ejes** y repite el cajón de sastre que Teuton ya tiene. Propuesta
   alternativa en `KEEP-DROP-CHANGE.md` §Taxonomía: tres estados académicos y un
   campo de causa aparte.

3. **«Tests declarativos YAML» necesita una política explícita sobre la
   parametrización por alumno**, o se reinventa el problema de `c14-check` (dos
   alumnos, dos denominadores, la misma nota). Ver §5.

4. **El NDJSON no debería ser el primer entregable.** Un escritor de
   compatibilidad que produzca `resume.json` y `case-NN.json` permite validar el
   motor entero contra la UAT hostil de la GUI (40 escenarios ya escritos) sin
   tocar la GUI. Ver §7.

---

## 2. Arquitectura propuesta

La de la dirección preliminar, con **una fase añadida** que resuelve varios
problemas a la vez:

```
GUI existente
   │  (fase 1: ficheros compatibles · fase 2: NDJSON)
   ▼
CLI del motor  ──── escribe ───►  informe JSON atómico
   │
   ▼
PLAN   inventario × examen → lista fija y numerada de comprobaciones
   │   (aquí se conoce el total; aquí se valida todo lo validable)
   ▼
SCHEDULER   N alumnos en vuelo · timeouts · cancelación · reintentos de conexión
   │
   ▼
TRANSPORTE SSH   una sesión por alumno y host, reutilizada
   │
   ▼
máquinas del alumnado
```

**Por qué la fase PLAN importa.** Es lo único que hace posible, a la vez:

- anunciar el total de comprobaciones antes de empezar (hoy la GUI lo adivina de
  `teuton check` y se equivoca, `c14-check`);
- que el **denominador de la nota esté fijado antes de tocar ninguna máquina**,
  de modo que nada que ocurra durante la ejecución pueda encogerlo (F-02);
- que el mismo examen produzca el mismo denominador para todos los alumnos;
- rechazar configuraciones inválidas sin efectos secundarios (F-06).

Es la diferencia estructural más importante frente a Teuton, donde el plan se
va descubriendo *mientras* se ejecuta, porque el examen es código.

## 3. Modelo de datos

```
Ejecución
  id, inicio, fin, estado (COMPLETA | PARCIAL | CANCELADA | ABORTADA)
  examen (ruta + hash), inventario (ruta + hash)
  Alumno[]
     id, nombre, moodle_id, estado (OK | PARCIAL | SIN_EVALUAR)
     nota { obtenido, evaluable, total, valor_0_100 }
     Comprobación[]
        id, grupo, descripción, peso
        resultado (PASS | FAIL | UNEVALUATED)
        causa (solo si UNEVALUATED): CONNECT_FAILED | AUTH_FAILED | TIMEOUT
                                   | CONNECTION_LOST | NOT_RUN | CANCELLED
                                   | ENGINE_ERROR
        host, comando (con secretos ya enmascarados), exit_code
        stdout, stderr (separados, recortados, con marca de recorte)
        duración, intentos
```

Tres decisiones que se leen directamente de las pruebas:

- **`nota.evaluable` y `nota.total` son campos distintos.** `evaluable` es
  `PASS + FAIL`; `total` es lo que dijo el PLAN. Si difieren, hubo avería, y se
  ve sin interpretar nada. Es la respuesta a F-07 y a F-02.
- **`stdout` y `stderr` separados y conservados.** Teuton paga toda la memoria de
  la salida y no guarda nada de ella (`PERFORMANCE.md` §3). Un tope (p. ej. 64 kB
  por flujo, con marca de recorte) da lo mejor de los dos: el profesor ve por qué
  falló, y 300 MB de `cat` accidental no tumban el examen.
- **`intentos`** deja el reintento auditado. Un reintento invisible es otra forma
  de error silencioso.

## 4. Principios no negociables: cómo los cumple el diseño

| Principio | Mecanismo | Fallo actual que elimina |
|---|---|---|
| 1. Integridad de la nota | Denominador fijado en PLAN; `UNEVALUATED` fuera de la nota; hash del examen y del inventario en el informe | F-02, F-07, F-14 |
| 2. Errores nunca silenciosos | Nombre desconocido en el YAML = error de validación, no aviso; exit codes discriminantes; `warnings` en el informe | F-02, F-06, F-10 |
| 3. Error técnico ≠ fallo académico | Dos ejes (`KEEP-DROP-CHANGE.md` §Taxonomía) | F-07 |
| 4. Nada bloquea el examen | Timeout por comprobación, por alumno y por ejecución; cierre del canal remoto al vencer | F-04 |
| 5. Un alumno roto no bloquea al resto | Cada alumno es una unidad aislada; un fallo se captura y se convierte en estado, nunca en aborto | F-03 |
| 6. Secretos fuera de informes y logs | Los secretos no están en el fichero de examen; el comando se registra con marcadores | `SECURITY.md` |
| 7. Instalación sencilla | Un binario | C1 de `GUI-CONTRACT.md` |
| 8. Diseño pequeño | Sin telnet, sin macros, sin pasarela reconstruida, un solo formato nativo | D-3..D-7 |

## 5. El punto difícil: expresividad del YAML

Es el riesgo real de «tests declarativos», y conviene mirarlo de frente.

**[PRUEBA]** Los exámenes reales de Teuton usan bucles y condicionales
(`c14-check` viene de ese patrón). Un YAML sin nada de eso obliga a escribir a
mano 30 comprobaciones casi idénticas, y el profesor volverá a querer código.

**[PRUEBA]** Pero el condicional es justo lo que produce el defecto: dos alumnos
examinados de cosas distintas, ambos con un 100 y sin rastro en el informe.

Propuesta: **separar sustitución de decisión**.

- **Sí**: sustitución de variables del alumno en comandos y valores esperados
  (`{{ host1.ip }}`, `{{ alumno.usuario }}`). No cambia el número de
  comprobaciones. Cubre la mayoría del uso real.
- **Sí**: expansión por lista declarada en el examen (`for_each: [http, ftp,
  ssh]`), que genera N comprobaciones — pero la lista está en el **examen**, no
  en el alumno, así que **todos los alumnos obtienen las mismas N**.
- **No en el MVP**: condicionales dependientes del alumno. Si más adelante hacen
  falta (itinerarios distintos por grupo), la forma correcta es **varios exámenes**
  o un campo `variante` del alumno que seleccione un **fichero de examen
  completo**, de modo que el denominador siga siendo uniforme dentro de cada
  variante y el informe diga qué variante se aplicó.

Regla que lo cierra: **el informe siempre publica `total` y el hash del examen
aplicado**. Si dos alumnos tienen `total` distinto, se ve a simple vista.

## 6. Decisiones todavía abiertas

**D-1 · ¿Cómo se paran los comandos que no terminan?**
Cerrar el canal SSH libera al motor, pero **[PRUEBA]** en `s05-hang` el `sleep`
quedó huérfano en la máquina del alumno. Opciones: aceptar el huérfano; envolver
cada comando en un `timeout N ...` remoto (requiere coreutils en el alumno);
o pedir el `signal` de SSH (soporte desigual en servidores). Hay que elegir y
documentarlo, porque afecta a la máquina del alumno durante el examen.

**D-2 · ¿SSH nativo en Go o el binario `ssh` del sistema?**
- *Nativo* (`golang.org/x/crypto/ssh`): binario único de verdad, control total de
  timeouts y cancelación, claves OpenSSH modernas sin drama (justo lo que falla
  en F-12). Coste: hay que implementar a mano `known_hosts`, `ProxyJump` y la
  lectura de `~/.ssh/config`.
- *Delegar en `ssh`*: se heredan gratis `ssh_config`, agente, `ProxyJump` y las
  políticas que el profesor ya tiene. Coste: deja de ser un binario único
  (aunque `openssh-client` está en todas partes), y el multiplexado
  (`ControlMaster`) es más frágil de gobernar que una sesión en proceso.

Recomendación: **nativo**, porque el control de timeout y cancelación (principio
4) es precisamente lo que no se puede delegar bien, y porque K-6 (una sesión
reutilizada) es trivial en proceso. Pero es una decisión con consecuencias y
debe tomarse a propósito.

**D-3 · Política de `known_hosts`.**
**[PRUEBA]** La política de Teuton (heredar el `known_hosts` del profesor) fue lo
que tumbó el primer intento de esta investigación. En un aula las máquinas se
reinstalan y las claves de host cambian cada curso. Opciones: TOFU con aviso,
ignorar con aviso ruidoso en el informe, o fichero de `known_hosts` propio del
proyecto. Es una decisión de seguridad, no de comodidad.

**D-4 · ¿Dónde viven las credenciales del aula?**
`SECURITY.md` §6 dice que fuera del fichero de examen. Falta decidir el
mecanismo: `.env.local` junto al proyecto, variables de entorno, o el llavero del
escritorio — que es lo que **la GUI ya usa** (`getCredentialsStatus`,
`default-globals.json` cifrado). Conviene que el motor y la GUI no tengan dos
almacenes distintos.

**D-5 · ¿Se conserva la detección de valores repetidos (`unique`)?**
Es anticopia y tiene valor, pero hoy pone la nota a 0 automáticamente (D-8). Si
se conserva, debe ser una marca en el informe.

**D-6 · Límite de concurrencia por defecto.**
**[PRUEBA]** `MaxStartups 10:30:100` es el valor por defecto de OpenSSH. Un tope
global de 8-16 es seguro, pero lo correcto puede ser un tope **por host de
destino** además del global. Hay que medirlo con el aula real.

**D-7 · Nombre.** Pendiente. Solo afecta al módulo Go, al binario y al README.

## 7. Primer prototipo vertical

La propuesta preliminar (un `aula.yaml`, un `examen.yaml`, un host, una
comprobación, timeout, `ExecutionResult` tipado, un evento NDJSON, un JSON de
resultado) es **del tamaño correcto**. Dos ajustes, ambos justificados por las
pruebas:

**Añadir la fase PLAN desde el minuto uno**, aunque sea trivial con una sola
comprobación. Es la pieza de la que cuelga la integridad de la nota, y
retrofitarla después es rehacer el motor.

**Añadir un segundo alumno, deliberadamente roto.** Con un solo alumno no se
puede demostrar el principio 5, que es el que hoy falla de la peor manera (F-03:
la clase entera se pierde). El prototipo debe demostrar que el alumno A se
evalúa y se escribe aunque el B no responda.

### Alcance exacto propuesto

```
aula.yaml        2 alumnos: uno contra el contenedor SSH, otro contra un puerto cerrado
examen.yaml      1 comprobación con peso
motor            plan → scheduler (concurrencia 2) → ssh → informe
timeout          por comprobación
salida           1 línea NDJSON por evento + informe.json atómico
```

### Criterios de aceptación, todos medibles contra el laboratorio ya montado

1. Alumno A: `PASS`, nota 100. Alumno B: `UNEVALUATED` / `CONNECT_FAILED`,
   estado `SIN_EVALUAR`, **sin nota 0**.
2. El informe se escribe **con los dos alumnos** aunque B falle (contra F-03).
3. Con `sleep 100000` en el examen, el motor termina en el timeout, marca
   `TIMEOUT` y **escribe el informe** (contra F-04 y F-16).
4. `grep TEUTON_SECRET` sobre el NDJSON, el informe y la terminal: **cero
   coincidencias** (contra `SECURITY.md`).
5. Una clave del examen mal escrita **impide ejecutar** y señala fichero y línea
   (contra F-02).
6. Un host `127.0.0.1` se conecta por SSH a `127.0.0.1`, no se ejecuta en local
   (contra F-01).
7. El informe declara `total` y `evaluable` por alumno, y coinciden en A.
8. El mismo examen bajo `LANG=es_ES` y `LC_ALL=C` da la **misma** nota (contra
   F-08). Basta con que el prototipo no compare mensajes del sistema; el criterio
   obliga a elegir bien la comprobación de ejemplo.

Los ocho se comprueban con el `Containerfile` y los proyectos de `evidence/`,
que ya existen.

### Lo que el prototipo NO debe llevar

Ni exportación a Moodle, ni HTML, ni `--case`, ni reintentos, ni pasarela, ni
compatibilidad con los ficheros de Teuton. Todo eso viene después y solo después
de que los ocho criterios pasen.

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| **El YAML declarativo no da para los exámenes reales** y acaba creciendo hacia un lenguaje | alta | alto | §5. Antes de escribir el motor, **traducir a YAML dos exámenes reales del curso** y ver qué falta. Es la prueba más barata y la que más decisiones cierra |
| **Dos motores conviviendo** durante un curso, con dos formatos y dos conjuntos de fallos | media | alto | El escritor de compatibilidad (§7 de `GUI-CONTRACT.md`) hace que la GUI no sepa cuál está usando |
| **Regresión silenciosa de notas** al cambiar de motor | media | muy alto | Ejecutar ambos motores sobre el mismo examen y el mismo aula y **comparar nota por nota**. Es un test, no una revisión a ojo |
| **Reimplementar `ProxyJump`, `known_hosts` y `ssh_config`** a mano en Go | media | medio | D-2. Si se va a nativo, acotar: `known_hosts` sí, `ProxyJump` solo si hace falta, `ssh_config` no |
| **Ningún dato de rendimiento del motor nuevo** (no hay Go en el equipo) | segura | bajo | `PERFORMANCE.md` §6 define exactamente qué medir y con qué proyectos |
| **La GUI asume dos ficheros y un editor de Ruby** | baja | bajo | K-12: mantener la forma de dos ficheros |
| **El profesor pierde funciones que sí usaba** (macros, `use`, formatos) | media | medio | Antes de eliminar: revisar los exámenes reales del curso y contar qué se usa de verdad |
| **Teuton sigue vivo** (v3.0.0 de 2026) y se aleja del contrato | baja | bajo | La GUI seguirá siendo compatible mientras mantenga el escritor de compatibilidad |

Nota sobre el último punto: **[PRUEBA]** v3.0.0 introduce una regresión (F-11,
`tt_skip` aborta la ejecución) que la suite de 164 tests no detecta. Conviene no
actualizar el Teuton instalado en el equipo del aula sin probarlo antes.
