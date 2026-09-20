# ADR-0019 · Consolidar una cadena de correcciones

- Estado: **aceptada** · 2026-09-20
- Abre y cierra lo que ADR-0018 §5 dejó pendiente: la regla de la vista
  consolidada
- Contexto: ADR-0004, ADR-0006, ADR-0007, ADR-0018, principio 12

## Contexto

ADR-0018 dejó el reintento cerrado y con una consecuencia deliberada: en el
artefacto de un reintento parcial, `final_score` sigue siendo `null`, porque
desde el punto de vista de esa ejecución quedan comprobaciones sin evaluar. Las
que se evaluaron el día anterior viven en el artefacto del día anterior, y no
se copian.

Eso es correcto por artefacto y es insuficiente en el aula: el alumno cuya
máquina estaba apagada el martes y contestó el miércoles **está entero**, y su
nota está completa aunque ningún fichero suelto lo diga. Falta la regla que lee
los dos ficheros como una sola cosa, y el sitio donde se aplica.

## Decisión

### 1. La regla: por comprobación, la ejecución más reciente que la evaluó

Para cada alumno y cada comprobación del PLAN, el resultado que vale es el de
la **ejecución más reciente que la evaluó** —la que le dio `PASS` o `FAIL`—.
Si ninguna la evaluó, vale el intento más reciente, para que el motivo que lee
el profesor sea el último que ocurrió y no el primero.

No hay preferencia por «lo mejor» ni por «lo peor»: hay preferencia por lo más
reciente, que es la única regla que no depende de a quién beneficie.

### 2. El denominador es el del PLAN, el mismo en toda la cadena

La nota consolidada se calcula con `ComputeScore` contra `total_weight` del
PLAN, igual que la de una ejecución suelta (ADR-0004). Mientras quede una
comprobación con peso sin evaluar **en toda la cadena**, no hay nota final
(ADR-0006). Consolidar no relaja la regla 1 de la política de nota: la aplica
sobre más información.

### 3. Una cadena con otro `plan_hash` se rechaza

Si dos ejecuciones de la cadena no comparten `plan_hash`, no se consolidan:
sumar comprobaciones con pesos distintos le daría a la clase un denominador que
no existió nunca. Es error de configuración, exit 2, y se dice cuál de las dos
ejecuciones no encaja.

Por la misma razón, un eslabón que no se puede leer **para** la consolidación
entera. Consolidar media cadena convertiría lo que falta en «sin evaluar» sin
decirlo, que es el error silencioso del principio 2.

### 4. La consolidación la calcula el motor, no la interfaz

Es una decisión de arquitectura y va en contra de la comodidad: la GUI ya tiene
los artefactos abiertos y podría sumar. No lo hace. `ComputeScore` es la única
implementación de qué es una nota y vive en `internal/model` (principio 12);
una segunda copia en TypeScript sería una nota que puede divergir de la del
motor sin que nadie se entere, y el redondeo y el margen de los pesos decimales
son exactamente donde divergiría.

El motor publica la consolidación por `heimdall consolidate <resultado.json>`:
lee la cadena hacia atrás siguiendo `retry_of`, la escribe por la salida
estándar y **no escribe ningún fichero**. La GUI la enseña; no la calcula.

### 5. La consolidación es una vista, no un artefacto

Lleva `kind: "consolidation"` y su propia versión, distinta de la del
artefacto, para que nada pueda leerse como una ejecución que no existió.
Ninguna ejecución de la cadena se reescribe ni se toca (ADR-0007).

Cada resultado dice de qué ejecución sale (`from_run`) y qué intentos hubo
**antes** (`attempts`). Una comprobación que una ejecución posterior no
seleccionó no es un intento: en el artefacto del reintento sale `NOT_RUN`
(ADR-0018 §5) y ahí no se cuenta como si se hubiera probado.

### 6. No lleva ni comandos ni salida de las máquinas

La consolidación es una lectura de resultados, no una copia de la evidencia. El
comando, la salida y la aserción siguen en el artefacto de la ejecución que los
produjo, que es donde se leen. Así también es pequeña y se puede enseñar entera.

### 7. Exit codes iguales a los de una ejecución

`0` cuando en toda la cadena no queda nada por evaluar · `3` cuando queda algo ·
`2` cadena inválida. Un profesor o un script pueden preguntar «¿está cerrada
esta clase?» sin mirar el JSON.

## Alternativas descartadas

- **Consolidar en la GUI.** Descartada en §4: duplica la función que calcula la
  nota.
- **Escribir un artefacto consolidado.** Sería una ejecución que nunca ocurrió,
  con un `run_id` que no corresponde a ninguna máquina contestando. ADR-0018 ya
  descartó mezclar dos ejecuciones en una por esto mismo.
- **Quedarse con el mejor resultado de cada comprobación.** Le da al alumno
  cuya máquina falló intentos que el resto no tuvo. Es la misma razón por la
  que un `FAIL` no se repite.
- **Consolidar ejecuciones que no formen cadena** (dos correcciones completas
  de la misma clase el mismo día). Fuera: sin `retry_of` no hay forma de saber
  cuál sustituye a cuál, y elegir por fecha sería inventar una relación que
  nadie declaró.
