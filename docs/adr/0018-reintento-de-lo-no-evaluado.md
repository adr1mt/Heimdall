# ADR-0018 · Ante un incompleto: dejar pendiente o repetir solo lo no evaluado

- Estado: **aceptada** · 2026-09-20
- Cierra: **D-8** (`08-DECISIONES-ABIERTAS.md`)
- Contexto: ADR-0004, ADR-0006, ADR-0007, `03-ESTADOS-Y-NOTA.md` §5

## Contexto

ADR-0006 dejó cerrado que una evaluación incompleta no produce nota final.
Quedaba abierto lo otro: qué se le **ofrece** al profesor cuando la pantalla de
resultados le enseña un alumno en ámbar.

El caso real es de aula: de veinte alumnos, tres tenían la máquina apagada, el
cable fuera o el servicio caído en el minuto en que se corrigió. El profesor
arregla eso en clase y quiere la nota de esos tres sin volver a examinar a los
otros diecisiete, y sin que la segunda pasada le cambie a nadie una nota que ya
estaba puesta.

Todo lo que se ofrezca aquí toca la integridad de la nota, que es el principio
1. Una acción cómoda de más en esta pantalla es la vía más corta para fabricar
una nota que nadie se ganó.

## Decisión

### 1. La acción por defecto es dejarlo pendiente

Ante un incompleto la aplicación **no hace nada** por su cuenta. Enseña lo que
falta y ofrece dos salidas, con «Dejarlo pendiente» como opción normal y
preseleccionada. Un incompleto es un estado legítimo de un examen: quedarse ahí
no necesita justificación, repetir sí.

### 2. Lo único que se repite es lo que no se pudo evaluar

El reintento se aplica **exclusivamente a las comprobaciones `UNEVALUATED`**.
Un `FAIL` no se repite nunca de forma automática: un fallo del alumno ya tiene
resultado, y volver a tirarlo sería darle intentos hasta que salga. Un `PASS`
tampoco, por la misma razón en el otro sentido.

De esto se sigue que el reintento es por **comprobación**, no por alumno. Los
alumnos que no tienen ninguna comprobación sin evaluar ni siquiera entran en la
ejecución.

### 3. Cada reintento es una ejecución con su propio artefacto

El artefacto es inmutable (ADR-0007). Un reintento no reescribe nada: resuelve
el mismo PLAN, abre su propia ejecución, con su `run_id`, y escribe su propio
`run-<id>.json`.

Para que ese artefacto se pueda leer solo, lleva dos cosas nuevas:

- a nivel de ejecución, `retry_of`: de qué ejecución viene, en qué fichero está
  y cuántos alumnos y comprobaciones se repitieron;
- a nivel de comprobación, `previous`: qué estado, qué causa y qué explicación
  tenía esa misma comprobación en la ejecución anterior.

`previous` es rastro, no resultado. Ninguna función de nota lo mira:
`ComputeScore` sigue leyendo solo `Status` y `Weight` de **esta** ejecución, y
`Classify` sigue sin saber que existe. Es la diferencia entre conservar la
evidencia de que hubo un intento previo y mezclar dos ejecuciones en una.

### 4. El PLAN del reintento es el mismo PLAN

Antes de tocar ninguna máquina se compara el `plan_hash` de la ejecución
anterior con el del PLAN recién resuelto. Si no coinciden —el examen o el aula
se han editado entre medias— es error de configuración y el reintento no
empieza: exit 2, ninguna máquina tocada (ADR-0002).

Con los hashes iguales, `check_ids`, `weights` y `total_weight` son por
construcción los de siempre. El denominador no se mueve (ADR-0004).

Esto tiene una consecuencia que conviene decir: si lo que había mal era el
`aula.yaml` —una IP equivocada, un puerto que no era— el reintento no vale,
porque arreglar el fichero cambia el PLAN. Esa clase se corrige entera otra
vez. El reintento es para cuando lo que se arregla es la máquina, no el examen.

### 5. Lo que no se repite sale `UNEVALUATED` con causa `NOT_RUN`

En el artefacto del reintento, una comprobación que no entraba en la selección
aparece como `UNEVALUATED` con causa `NOT_RUN` y su `previous` al lado. No se
copia su resultado anterior: ese resultado vive en su artefacto y allí se lee.

La consecuencia es deliberada: **en el artefacto de un reintento parcial,
`final_score` sigue siendo `null`**, porque desde el punto de vista de esa
ejecución quedan comprobaciones sin evaluar. Ninguna acción automática
convierte un `UNEVALUATED` en `FAIL` ni fabrica una nota final. La vista
consolidada de una cadena de ejecuciones —la que sí puede dar por cerrado a un
alumno— es trabajo aparte (T057) y tiene que salir de una regla escrita y
probada, no de este ADR.

### 6. No hay «marcar a mano» en el MVP

Se estudió una acción manual del tipo «resolver» o «dar por fallada» una
comprobación que no se puede repetir. Queda **fuera**. Complica el modelo
justo donde no se puede permitir: obligaría a un resultado que no viene del
motor, a distinguirlo en todas las vistas y en todos los cálculos, y a
defender que nunca se confunde con uno real.

Si vuelve, será como dice ADR-0006: un artefacto aparte, con autor y fecha,
explícito, marcado como manual, y **conservando intacto el resultado del
motor**. Nunca una reescritura del `run-<id>.json`.

### 7. En la pantalla, comprobaciones y peso son dos cifras distintas

Lo que falta se dice con las dos: «faltan 3 comprobaciones de 12» y «falta 4 de
10 de peso». Las comprobaciones no pesan lo mismo, y una sola cifra invita a
leer un incompleto como pequeño cuando la que falta es la que más pesa.

### 8. Los comandos del detalle siguen siendo los del motor

El detalle de una comprobación repetida enseña el vector de argumentos tal como
lo publica el artefacto, ya saneado y redactado por el escritor. El reintento
no abre ninguna vía nueva: no acepta comandos, no toma valores de la pantalla y
no vuelve a pedir nada que no sean las credenciales del aula, que viajan por
stdin como en cualquier ejecución (ADR-0009).

## Alternativas descartadas

- **Repetir el alumno entero.** Es lo más simple de implementar y da un
  artefacto completo y autosuficiente. Se descarta porque repite sus `FAIL`: el
  alumno cuya máquina se cayó a mitad saldría con dos oportunidades en las
  comprobaciones que ya había fallado y el resto de la clase con una.
- **Acumular los resultados anteriores dentro del artefacto del reintento.**
  Daría nota final de una tacada. Se descarta porque convierte el artefacto en
  una mezcla de dos ejecuciones, y a partir de ahí ya no se puede decir qué
  máquina contestó qué ni cuándo.
- **Reintento automático al detectar un incompleto.** Se descarta por el
  principio 4 en su versión de aula: una máquina que no está encendida no se
  enciende sola, y reintentar sin que el profesor haya hecho nada solo gasta
  tiempo y esconde el problema real.
- **Un umbral («si falta menos del 5 %, dalo por bueno»).** Ya descartado en
  ADR-0006 y se descarta otra vez aquí por lo mismo.
