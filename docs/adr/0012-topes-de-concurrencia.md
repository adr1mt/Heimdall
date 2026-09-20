# ADR-0012 · Dos topes de concurrencia: 8 alumnos a la vez, 4 conexiones por máquina

- Estado: **aceptada** · 2026-09-20
- Acota **D-6** de `08-DECISIONES-ABIERTAS.md`; el tope global que fija aquí
  queda medido y subido a 16 por ADR-0013, que cierra D-6
- Contexto: `FAILURE-MODES.md` F-05, `PROPOSAL.md` §D-6, `PERFORMANCE.md` §6,
  ADR-0010

## Contexto

El fallo que más ceros produce en Teuton no lo causa ninguna máquina del
alumnado: lo causa el propio motor. Sin tope, 53 de 100 alumnos salen con cero
porque el servidor SSH rechaza las conexiones (F-05). `MaxStartups 10:30:100`
es el valor por defecto de OpenSSH: pasadas **diez** conexiones sin autenticar,
el servidor empieza a rechazar, y a partir de cien las rechaza todas. El rechazo
ocurre antes de que nadie escriba una contraseña, así que no distingue entre un
alumno que ha hecho mal el ejercicio y uno al que no se le ha llegado a
preguntar.

El mecanismo estaba cerrado desde la propuesta: un tope global más un tope por
host de destino. Los números eran conjetura y faltaba medirlos.

## Decisión

Dos límites, independientes:

1. **Tope global**: cuántos alumnos se evalúan a la vez. Por defecto **8**.
2. **Tope por máquina de destino**: cuántas sesiones se están **abriendo** a la
   vez contra la misma dirección y puerto. Por defecto **4**.

El segundo cubre solo la apertura. Una sesión ya autenticada deja de contar para
`MaxStartups`, así que los comandos se ejecutan sin esperar turno a nadie.

Ambos se publican en el artefacto (`plan.concurrency`,
`plan.host_concurrency`): el informe dice en qué condiciones se corrigió. Ambos
se pueden cambiar desde la línea de órdenes (`--concurrency`,
`--host-concurrency`).

Esperar turno nunca es una espera infinita ni tapa una cancelación: el turno se
pide contra el contexto del alumno, y si se agota su presupuesto esperando, la
comprobación sale sin evaluar con ese motivo escrito, jamás suspensa.

## Evidencia

`test/carga.sh`: 100 alumnos contra un único contenedor con `MaxStartups` por
defecto, tres ejecuciones.

| Ejecución | Conexiones rechazadas | Sin evaluar | Tiempo |
|---|---|---|---|
| Con topes (8 / 4) | 0 | 0 | 3 s |
| Sin tope por máquina (100 a la vez) | 38–49 de 100 | 0 | 2–5 s |

El control no pierde ninguna nota porque el reintento de ADR-0010 absorbe los
rechazos, que es precisamente lo que Teuton no tiene. Pero casi la mitad de la
clase depende ahí de que el reintento acierte, y cada rechazo cuesta uno o tres
segundos de espera. Con el tope puesto no hay un solo rechazo que absorber, y la
ejecución no es más lenta.

Que el número medido de rechazos (38–49) se parezca tanto al de Teuton (53 de
100) confirma que la causa es la misma y que está en el lado del servidor.

## Consecuencias

- Un aula que comparte un único servidor —el caso del examen de servicios de
  red— se corrige entera sin que el motor genere ni un cero técnico.
- Un aula con una máquina por alumno no nota el tope por máquina: cada destino
  tiene el suyo.
- 8 y 4 son valores por defecto, no límites del diseño. Un profesor con un
  servidor que aguante más sube `--host-concurrency`; los números quedan escritos
  en el artefacto de esa corrección.
- No hay reparto adaptativo. Si aparece la necesidad, ADR nuevo.
- El tope por máquina, **4**, está medido. El tope global, **8**, no lo estaba:
  esta medición fija cuántas conexiones aguanta un servidor, no cuántos alumnos
  conviene llevar a la vez. Medido en ADR-0013, que lo sube a **16**.
