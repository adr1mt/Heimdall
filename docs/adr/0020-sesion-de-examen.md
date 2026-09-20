# ADR-0020 · La sesión de examen: la mejor nota completa

- Estado: **aceptada** · 2026-09-20
- Cierra D-10
- Contexto: ADR-0004, ADR-0006, ADR-0007, ADR-0018, ADR-0019, principios 1, 6,
  7 y 12

## Contexto

El modo examen (T058) corrige la clase una y otra vez mientras dura la
práctica. Hoy cada vuelta es una corrección suelta con su artefacto: la última
sustituye a la anterior en pantalla, y un alumno que tenía la práctica bien
hecha a las 10:20 y rompió algo a las 10:40 se queda con lo de las 10:40.

Eso no es lo que ocurre en el aula. Durante la práctica el alumnado toca la
máquina todo el rato: instala, rompe, arregla y vuelve a probar. Cada vuelta es
una **fotografía del mismo examen**, no un intento independiente. La nota de la
práctica es lo mejor que el alumno llegó a tener entero, no lo que quedara en
pie en el instante arbitrario en que terminó la última vuelta.

ADR-0019 ya fijó una regla de varias ejecuciones, y es **la contraria**: en una
cadena de reintento manda lo más reciente. No es una contradicción, son dos
situaciones distintas, y la diferencia importa lo bastante como para escribirla:

| | Cadena de reintento (ADR-0019) | Sesión de examen (este ADR) |
|---|---|---|
| Qué la forma | `retry_of`: una ejecución declara a cuál repite | Varias vueltas del mismo PLAN corridas seguidas |
| Qué se repite | **Solo** lo que quedó sin evaluar | La clase entera, cada vez |
| Por qué hay varias | La máquina falló, el alumno no estaba | El alumno sigue trabajando |
| Qué manda | Lo más reciente, por comprobación | La **mejor nota completa**, por alumno |
| Unidad de elección | La comprobación | La vuelta entera |

La regla de ADR-0019 elige por comprobación porque ahí la información nueva
sustituye a la vieja: la máquina estaba apagada y ahora contestó. Aquí la
información no sustituye a nada, se **añade**: son cuatro estados sucesivos de
la misma máquina, todos ciertos en su momento.

**La frontera, en dos líneas, y no se cruza:**

- **cadena de reintento técnico** → vale el resultado evaluado más reciente;
- **sesión de examen** → vale la mejor nota completa obtenida en la sesión.

Lo que decide cuál se aplica no es una preferencia: es qué relación declararon
las ejecuciones. Con `retry_of`, cadena. Vueltas sucesivas del mismo PLAN
dentro de una sesión, sesión. Ninguna implementación puede mezclarlas, y T063
publica la sesión por su propio subcomando y su propio `kind`, nunca a través
de `consolidate`.

## Decisión

### 1. La regla: por alumno, la mejor vuelta con nota completa

Para cada alumno, la nota de la sesión es la **mayor `final_score` entre las
vueltas en las que su evaluación quedó completa**. Con 6, 8, 7 y 9, la nota es
9. La vista dice siempre de qué vuelta sale.

Se elige la vuelta entera, no comprobación a comprobación. Coser la mejor
versión de cada comprobación construiría un alumno que nunca existió: uno que
tuvo el servidor bien a las 10:20 y el cortafuegos bien a las 11:00, sin que
las dos cosas estuvieran bien a la vez nunca. Lo que se nota es un estado real
de la máquina, y un estado real es una vuelta.

Si dos vueltas empatan en la mejor nota, vale la **primera** que la alcanzó:
es el momento en que el alumno llegó ahí, y las vueltas posteriores no añaden
nada.

### 2. Solo compiten las vueltas completas

**Nota completa** significa exactamente esto: todas las comprobaciones con peso
del PLAN se pudieron evaluar en esa vuelta, y por tanto hay `final_score`. Ni
una sola `UNEVALUATED` con peso > 0. Es la regla 1 de la política de nota
(ADR-0006) aplicada vuelta a vuelta, sin umbral de tolerancia.

Una vuelta solo entra en la comparación si es completa. Una nota provisional no
es una nota: compararla con una completa sería comparar un 100 % de tres
comprobaciones con un 90 % de diez.

De ahí sale lo que más protege al alumno: **una vuelta posterior no puede
rebajar nada**. Si la máquina se apaga en la vuelta 5, esa vuelta no compite, y
el 9 de la vuelta 4 sigue siendo la nota de la sesión. Un fallo técnico no baja
una nota que ya estaba puesta (principio 3).

### 3. Sin ninguna vuelta completa no hay nota de sesión

Mientras un alumno no tenga ni una sola vuelta completa, no tiene nota de
sesión, y la vista dice por qué (ADR-0006, principio 1). No se rellena con la
provisional de la última vuelta ni con un cero: un cero diría que el alumno no
hizo nada, y lo que pasó es que no se pudo mirar.

La vista publica igualmente el estado de la última vuelta, para que el profesor
vea qué está ocurriendo, pero nunca como nota de sesión.

### 4. `FINISHED` es el examen entero, y se deriva

Un alumno queda `FINISHED` cuando una vuelta le dio **todo el peso del PLAN**:
todas las comprobaciones evaluadas **y todas en `PASS`**.

Tener el examen entero evaluado no es haber terminado. Con las dieciséis
comprobaciones evaluadas y un 8, el alumno sigue `ACTIVE`: le quedan cosas por
arreglar, puede arreglarlas, y la sesión lo tiene que seguir corrigiendo. Lo
contrario echaría de la práctica a quien todavía puede subir, que es justo lo
que la regla de la mejor nota existe para permitir.

| Vuelta | Estado |
|---|---|
| 16 de 16 evaluadas, todas `PASS` → nota 10 | `FINISHED` |
| 16 de 16 evaluadas, nota 8 | `ACTIVE` |
| 15 de 16 evaluadas, provisional 9 | `ACTIVE`, y sin nota de sesión |
| Nota completa 8 en una vuelta y provisional o `UNEVALUATED` después | `ACTIVE`, con 8 como nota de sesión |

La comparación es sobre los **pesos crudos**, no sobre el entero 0-100 que se
publica: un 99,6 % redondea a 100 y no es haber terminado.

Los estados de sesión son tres y cerrados: `ACTIVE`, `FINISHED` y `EXCLUDED`.
Contestan a una sola pregunta —¿la vuelta siguiente todavía tiene que corregir
a este alumno?—, y no a si ya tiene nota: eso lo dicen la nota y la vuelta de
la que sale. Lo que se hace con `FINISHED` —dejar al alumno fuera de la vuelta
siguiente— es de T063 y es una decisión de ejecución, no de nota.

Nadie lo marca a mano, ni el profesor ni la interfaz: sale del modelo, como
`StudentStatus`.

### 5. La sesión se compone del mismo PLAN

Dos vueltas con distinto `plan_hash` no forman sesión: es exit 2, y se dice
cuál no encaja. Misma razón que ADR-0019 §3 —comparar notas contra
denominadores distintos no compara nada— y principios 6 y 7.

Las vueltas se entregan en el orden en que se corrieron. Una vuelta que
terminó antes que la anterior es un error de composición, no un orden que se
arregle por dentro: si el orden no es el real, «de qué vuelta sale la nota» es
mentira.

### 6. El histórico se conserva entero

La vista lleva, por alumno, **todas** las vueltas: cuál fue su estado y su nota
en cada una, y cuál es la que vale. Un examen donde solo se ve la mejor nota no
se puede defender ante un alumno que pregunta.

El histórico es un registro, nunca un resultado: ninguna nota lo lee.

### 7. Es una vista, y la calcula el motor

`kind: "session"`, versión propia, por la salida estándar, sin escribir ningún
fichero y sin tocar ni un artefacto (ADR-0007). Igual que ADR-0019 §4 y §5: la
interfaz la enseña y no suma nada, porque `ComputeScore` es la única definición
de qué es una nota (principio 12).

Tampoco lleva comandos ni salida de las máquinas: esa evidencia vive en el
artefacto de cada vuelta.

## Alternativas descartadas

- **La última vuelta manda**, como hoy. Castiga al alumno por seguir
  trabajando y convierte el final de la clase en una lotería: se nota el
  instante en que sonó el timbre.
- **La mejor comprobación de cada vuelta.** Descartada en §1: construye un
  alumno que nunca existió, y además le da a quien tuvo más vueltas —el que
  llegó antes, el que no se quedó sin máquina— intentos que el resto no tuvo.
- **La mejor nota provisional cuando no hay ninguna completa.** Descartada en
  §3: una provisional de tres comprobaciones no es comparable con nada.
- **Aplicar aquí la regla de ADR-0019.** Es la regla de un reintento técnico.
  Usarla en una sesión haría que romper algo al final borrase lo que ya estaba
  bien, que es exactamente lo que este ADR existe para evitar.
- **Marcar a mano a un alumno como terminado.** Una nota que depende de que
  alguien pulse un botón a tiempo no es una nota derivada (principio 12).
- **Dar por terminado a quien tiene el examen entero evaluado.** Descartada en
  §4: con un 8 y todo evaluado el alumno puede seguir arreglando cosas, y
  echarlo de la sesión le quitaría la nota que la regla §1 existe para darle.
