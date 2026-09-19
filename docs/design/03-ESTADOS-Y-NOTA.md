# Estados, causas técnicas y política de nota

---

## 1. Eje académico (3 estados, cerrado)

Por **comprobación**, no por alumno.

| Estado | Definición exacta | Entra en el denominador |
|---|---|---|
| `PASS` | El comando se ejecutó hasta el final **y** la aserción se cumplió | Sí, y suma |
| `FAIL` | El comando se ejecutó hasta el final **y** la aserción no se cumplió | Sí, no suma |
| `UNEVALUATED` | No se obtuvo una ejecución completa y fiable. El motor **no sabe** si el alumno lo hizo bien | No. Ni suma ni resta |

Regla dura: **`UNEVALUATED` nunca se convierte en `FAIL`**, ni por conveniencia
ni por «así hay nota». Y al revés: si hubo ejecución completa, el resultado es
`PASS` o `FAIL` aunque el exit code sea 127 — un comando que no existe en la
máquina del alumno es un fallo académico, no una avería del motor.

«Ejecución completa» tiene una definición operativa: se abrió el canal, se envió
el comando, **se recibió el exit status** y se leyeron los dos flujos hasta EOF.
Si falta cualquiera de esas cuatro, es `UNEVALUATED`.

## 2. Eje técnico: causa (8 valores, ninguno redundante)

Solo tiene sentido cuando el estado es `UNEVALUATED`. Con `PASS`/`FAIL` la causa
es siempre `NONE`.

| Causa | Cuándo exactamente | Ejemplo real |
|---|---|---|
| `NONE` | Hubo ejecución completa | Cualquier `PASS` o `FAIL` |
| `CONNECT_FAILED` | No se pudo **establecer** la sesión: puerto cerrado, host inalcanzable, DNS, timeout **de conexión**, clave de host rechazada | `s03-sshfail`: puerto cerrado, `10.255.255.1` |
| `AUTH_FAILED` | La sesión TCP se estableció y el servidor **rechazó las credenciales** | `s03-sshfail`: contraseña o usuario incorrectos |
| `TIMEOUT` | El comando se envió y **no terminó** dentro del `timeout` de la comprobación | `s05-hang`: `sleep 100000` |
| `CONNECTION_LOST` | La sesión estaba establecida y se **cayó** a mitad: la máquina se apaga, la red se corta, EOF inesperado | `s06-drop`: apagón durante la 2ª de 3 |
| `NOT_RUN` | El motor **decidió no ejecutarla**: una comprobación anterior del mismo alumno dejó la sesión inservible, o se agotó el presupuesto del alumno | Las 2 restantes de `s06-drop` |
| `CANCELLED` | El profesor paró la ejecución antes de que le llegase el turno o mientras corría | Botón «Parar» de la GUI, `Ctrl-C` |
| `ENGINE_ERROR` | Fallo del propio motor: pánico recuperado, error de escritura, bug. **Nunca silencioso** | Cualquier defecto nuestro |

### Por qué no se simplifica más

Se revisaron las cuatro fusiones plausibles y las cuatro se rechazan:

- **`CONNECT_FAILED` + `AUTH_FAILED`** → no: son dos instrucciones distintas para
  el alumno («enciende la máquina» vs «la contraseña no es esa»). Es lo mejor que
  tiene Teuton hoy (K-8) y sería una regresión.
- **`TIMEOUT` + `CONNECTION_LOST`** → no: uno deja **proceso huérfano** en la
  máquina del alumno y el otro no. Cambia lo que el profesor debe hacer después.
- **`NOT_RUN` + `CANCELLED`** → no: `CANCELLED` significa «el profesor decidió» y
  `NOT_RUN` «el motor no pudo». Confundirlos reabriría la discusión de si la
  pasada cuenta.
- **`ENGINE_ERROR` dentro de otro** → no: es la única causa que es un **bug
  nuestro**, y debe poder contarse y alertarse por separado.

Cada causa lleva además un campo libre `detail` (una frase, sin traza de pila)
para el mensaje concreto. La causa es para la máquina; el `detail`, para el
profesor.

### El caso frontera que conviene dejar escrito

Un comando que devuelve exit 127 «command not found» **es `FAIL`**, no
`UNEVALUATED`: la máquina respondió, y que falte el paquete es parte del examen.
Es justo lo contrario de F-09, donde el exit code dependía del shell del
profesor: con vector de argumentos, el 127 lo da el servidor del alumno y
significa exactamente eso.

## 3. Estado derivado del alumno

No se almacena, se calcula:

| Estado | Condición |
|---|---|
| `OK` | Ninguna comprobación `UNEVALUATED` de peso > 0 |
| `PARTIAL` | Alguna, pero no todas |
| `NOT_EVALUATED` | Todas las de peso > 0 son `UNEVALUATED` |
| `EXCLUDED` | `excluido: true` en el inventario: no se ejecutó nada, no hay nota |

Las comprobaciones de peso 0 se informan pero **no degradan el estado**: son
diagnóstico, no nota.

## 4. Estado de la ejecución

| Estado | Condición |
|---|---|
| `COMPLETE` | Todos los alumnos evaluables quedaron `OK` |
| `PARTIAL` | Algún alumno `PARTIAL` o `NOT_EVALUATED` |
| `CANCELLED` | El profesor paró; el artefacto se escribe igualmente con lo que haya |
| `INVALID_CONFIG` | El PLAN no pasó. No se tocó ninguna máquina, no hay resultados |

---

## 5. Política de nota (decisión cerrada)

### El modelo

Por alumno, cinco números y un estado:

```
obtained        suma de pesos de las comprobaciones PASS
evaluable       suma de pesos de las comprobaciones PASS + FAIL
total           peso total del PLAN (idéntico para todos los alumnos)
unevaluated     total - evaluable
provisional_score  round(100 * obtained / evaluable)   si evaluable > 0, si no null
final_score        round(100 * obtained / total)       SOLO si unevaluated == 0, si no null
status          COMPLETE | INCOMPLETE | NOT_EVALUATED | EXCLUDED
```

El ejemplo del enunciado queda así:

```
Check A: PASS         peso 2
Check B: UNEVALUATED  peso 4
Check C: UNEVALUATED  peso 4

obtained: 2   evaluable: 2   total: 10   unevaluated: 8
provisional_score: 100
status: INCOMPLETE
final_score: null
```

Y **nunca** «2/2 = 100» presentado como nota.

### Las reglas

1. **`final_score` es `null` mientras exista una sola comprobación
   `UNEVALUATED` de peso > 0.** Sin excepciones automáticas.
2. **`provisional_score` siempre se calcula** cuando hay algo evaluado, y va
   siempre acompañado de `unevaluated` y de `status`. Un consumidor que lea
   `provisional_score` sin mirar `status` está haciéndolo mal, y por eso el campo
   **no se llama `score`**.
3. **Un alumno que no se pudo evaluar no saca 0.** Saca `NOT_EVALUATED`,
   `provisional_score: null`. Es la diferencia entre «no hizo nada» y «no
   pudimos mirar», que hoy es indistinguible (F-07).
4. **La conversión a la escala del profesor (0-10, apto/no apto) no la hace el
   motor.** El motor publica 0-100 entero (K-2) y los números crudos; la GUI ya
   tiene la conversión configurable.
5. **La resolución de un `INCOMPLETE` es del profesor, no del motor.** Se hace
   fuera: reevaluar al alumno, o decidir a mano. Cuando la GUI permita decidir a
   mano, esa decisión se guarda como un artefacto aparte con autor y fecha,
   nunca reescribiendo el `run-<id>.json`.
6. **`unique` / anticopia no toca la nota.** Si se implementa algún día, es una
   marca en el informe (D-8).

### Excepciones examinadas, y por qué ninguna se acepta

- *«Si lo `UNEVALUATED` pesa menos del 5 %, publicar nota igualmente.»* No. El
  umbral es arbitrario y la comprobación caída puede ser la que más importa.
  Además convierte una decisión pedagógica en una constante del motor.
- *«Si el alumno no responde a nada, es un 0: no entregó.»* Tentador y **falso**:
  el cable de red del aula, el switch o el DHCP del profesor producen
  exactamente el mismo síntoma. `NOT_EVALUATED` y el profesor decide en diez
  segundos.
- *«Si la comprobación es de peso 0.»* No es una excepción: por definición no
  entra en la nota y no puede dejar `INCOMPLETE` a nadie.

La única flexibilidad admitida: un futuro `--asumir-fallo-tecnico-como-cero`
**explícito, registrado en el artefacto y nunca por defecto**. No está en el MVP
y no se implementa hasta que el profesor lo pida con un caso concreto.
