# ADR-0013 · 16 alumnos en paralelo, medido

- Estado: **aceptada** · 2026-09-20
- Cierra **D-6** de `08-DECISIONES-ABIERTAS.md`
- Completa ADR-0012, que dejó el tope global en 8 por conjetura
- Evidencia: `test/rendimiento.sh`, `PERFORMANCE.md` §6

## Contexto

ADR-0012 fijó dos topes independientes: cuántos alumnos se evalúan a la vez
(global) y cuántas sesiones se abren a la vez contra la misma máquina (por
destino). El segundo, 4, quedó medido: con él no hay ni un rechazo de `sshd`
con cien alumnos sobre un único servidor. El primero, 8, era una conjetura.

Faltaba saber qué cuesta y qué da ese número. La conjetura podía estar mal en
las dos direcciones: demasiado alto y ahogar el equipo del profesor, o
demasiado bajo y hacerle esperar de más.

## Medidas

`test/rendimiento.sh`, contra el laboratorio podman en `127.1.2.3:2201`.

**1. Toda la clase contra una sola máquina** (tope por destino en 4):

| Alumnos | 4 | 8 | 16 | 32 | todos |
|---|---|---|---|---|---|
| 10 | 0,42 s · 11 MB | 0,35 s · 11 MB | — | — | 0,35 s · 11 MB |
| 30 | 1,02 s · 13 MB | 0,99 s · 13 MB | 0,96 s · 13 MB | — | 0,91 s · 13 MB |
| 100 | 3,19 s · 14 MB | 2,86 s · 14 MB | 2,88 s · 15 MB | 2,83 s · 15 MB | 2,86 s · 16 MB |

Ninguna comprobación sin evaluar en ninguna fila. Cuando todos comparten
servidor, el tope global da igual: manda el tope por destino.

**2. Una máquina que escupe megabytes** (un alumno, `seq`):

| Salida | tiempo | RSS | leído |
|---|---|---|---|
| 1 MB | 0,17 s | 11 MB | 916 kB |
| 20 MB | 0,18 s | 12 MB | 8,2 MB |
| 100 MB | 0,15 s | 13 MB | 8,2 MB |
| 300 MB | 0,19 s | 12 MB | 8,2 MB |

**La memoria es plana.** Teuton, con la misma prueba, llegaba a 970 MB con 300
MB de salida: 3,2 veces el tamaño de lo que produjo el alumno, sin ningún tope.

**3. Lo que cuesta el tope global**, que es la medida que decide. Treinta
alumnos con máquina propia y seis segundos de comando cada uno:

| Concurrency | Tiempo | RSS |
|---|---|---|
| 4 | 49,1 s | 13 MB |
| 8 | 24,7 s | 13 MB |
| 16 | 13,4 s | 14 MB |
| 30 | 7,7 s | 16 MB |

## Decisión

**El tope global por defecto pasa de 8 a 16.** El tope por destino sigue en 4.

El escalado es casi perfecto y la memoria no lo paga: doblar el tope reduce a
la mitad lo que espera el profesor y cuesta 1 MB. La medida 1 dice además que
subirlo no hace daño en el caso contrario —toda la clase sobre un servidor—,
porque ahí el tope por destino sigue protegiendo al servidor igual.

No se sube más allá de 16. Cada alumno en vuelo es una conexión SSH viva en el
equipo del profesor, 16 ya cubre media clase típica de un ciclo, y el profesor
que quiera más lo pide con `--concurrency`.

## Consecuencias

- Una clase de 30 alumnos con máquina propia se corrige en la mitad de tiempo
  que con el valor anterior.
- Una clase que comparte servidor no nota el cambio: sigue en ~3 s con cien
  alumnos y sin un solo cero técnico.
- El número sigue escrito en el artefacto de cada corrección
  (`plan.concurrency`), así que una corrección vieja se explica sola.
- `test/rendimiento.sh` queda como la forma de repetir la medida cuando cambie
  el motor o la máquina. No es un test: no falla por ser más lento, solo si se
  pierde una comprobación.

## Lo que la medida ha dejado a la vista

Una comprobación cuya salida pasa de 8 MB sale **sin evaluar**, no suspensa: el
motor deja de leer, la sesión se corta y el resultado dice `CONNECTION_LOST`.
Nadie suspende por ello, que es la parte importante, pero los 64 kB que sí se
habían leído no se llegan a usar. Anotado como T032; no se toca aquí.
