# Rendimiento y límites

Todas las cifras son de **Teuton 2.10.6** medidas en este equipo con
`/usr/bin/time`. No hay ninguna medición del motor nuevo: **Go no está
instalado** en la máquina de trabajo.

Laboratorio: un contenedor Debian 12 + OpenSSH (`evidence/Containerfile`)
publicado en `127.1.2.3:2201`.

---

## 1. Escalado por número de alumnos **[PRUEBA]**

Proyecto `s09-scale`: 3 comprobaciones por alumno, una de ellas `sleep 1`.

| Alumnos | modo | tiempo | RSS | notas |
|---|---|---|---|---|
| 10 | paralelo | 1,50 s | 52 MB | 10 x 100 |
| 30 | paralelo | 1,69 s | 76 MB | 23 x 100, **7 x 0** |
| 100 | paralelo | 2,09 s | 156 MB | 47 x 100, **53 x 0** |
| 100 | paralelo, `MaxStartups 300` | 2,29 s | 162 MB | **100 x 100** |
| 100 | secuencial (`tt_sequence: true`) | **127,36 s** | 152 MB | 100 x 100 |

Tres lecturas:

1. **El paralelismo es el producto.** 2,3 s frente a 127 s. Quitarlo no es una
   opción.
2. **La concurrencia sin límite se paga en notas, no en tiempo.** Los ceros de
   las filas de 30 y 100 son conexiones rechazadas por `MaxStartups` de sshd, no
   exámenes mal hechos (F-05). El coste del fallo es invisible en el reloj.
3. **La memoria crece de forma lineal y modesta** con el número de alumnos
   cuando las salidas son pequeñas: ~1 MB por alumno.

## 2. Escalado por tamaño de salida **[PRUEBA]**

Proyecto `s08-mem`: un solo alumno, un solo comando que escupe N MB por SSH.

| Salida | tiempo | RSS |
|---|---|---|
| 1 MB | 0,34 s | 53 MB |
| 20 MB | 0,51 s | 142 MB |
| 100 MB | 1,10 s | 397 MB |
| 300 MB | 2,75 s | **970 MB** |

**RSS ≈ 3,2 x el tamaño de la salida, sin ningún tope.** La causa **[CÓDIGO]**
es que la salida se acumula íntegra como String y luego se parte en un array de
líneas (`encode_and_split`), lo que multiplica por el coste por objeto de Ruby.

Y esto es **por alumno y en paralelo**: 30 alumnos cuyo `cat` accidental saque
300 MB piden ~29 GB. El proceso muere por OOM y, por F-03/F-16, no queda ningún
informe.

Nada avisa: el ejemplo de 50 MB dio `grade 100` y `case-01.json` de **1,1 kB**,
porque del contenido solo se guarda `"(N lines)"`.

## 3. Coste de la salida enorme en el informe **[PRUEBA]**

Los artefactos **no** crecen con la salida: el informe guarda la primera línea o
`"(N lines)"`. Es decir, Teuton paga toda la memoria de la salida y **no
conserva nada** de ella. Para el profesor que quiere ver *por qué* falló una
comprobación, ese es el peor reparto posible.

## 4. La suite de tests **[PRUEBA]**

| Suite | tests | tiempo |
|---|---|---|
| Teuton, rápidos | 96 | 0,74 s |
| Teuton, todos | 164 | 11,86 s |
| Teuton GUI, unitarios | 192 | 1,02 s |
| Teuton GUI, e2e (Playwright, app real) | 40 (+2 omitidos) | ~60 s |

Los 68 tests lentos de Teuton son los de `test/command/slow_*`, que lanzan el
binario como subproceso. Toda la lentitud está ahí: la lógica pura se prueba en
menos de un segundo.

Nota operativa: la e2e de la GUI **falla entera (40/40) si no se ha ejecutado
antes `npm run build`**, con un `Process failed to launch` que no explica la
causa. Con `out/` presente, pasan las 40.

## 5. Latencia de los caminos de error **[PRUEBA]**

Tiempo hasta que Teuton se rinde, medido en `s03-sshfail` (modo secuencial):

| Avería | tiempo |
|---|---|
| puerto cerrado (ECONNREFUSED) | inmediato |
| password incorrecta | inmediato |
| usuario inexistente | ~5 s |
| host inalcanzable (10.255.255.1) | **~30 s** (el `timeout:` de `Net::SSH.start`) |
| comando que no termina | **infinito** (F-04) |

Los 30 s de una IP muerta son el único timeout que existe, y solo cubre la
conexión. Cuatro alumnos con averías tardaron 38 s en total.

## 6. El motor nuevo, medido

Ya no es una lista de deberes: `test/rendimiento.sh` la ejecuta. Mismo
laboratorio, mismo `/usr/bin/time`. Las tres tablas y la decisión que sale de
ellas están en **ADR-0013**; aquí queda la comparación con lo de arriba.

| | Teuton 2.10.6 | Evalon |
|---|---|---|
| 100 alumnos, un servidor | 2,09 s · 156 MB · **53 ceros** | 2,86 s · 14 MB · **0 ceros** |
| 300 MB de salida | 2,75 s · **970 MB** | 0,19 s · **12 MB** |
| 30 alumnos, 6 s de comando | — | 24,7 s con 8 · **13,4 s con 16** |

Tres lecturas:

1. **Los ceros técnicos han desaparecido.** Es el punto del ejercicio: los 53
   ceros de Teuton no los producían los alumnos.
2. **La memoria es plana.** Teuton pagaba 3,2 veces el tamaño de la salida del
   alumno y no conservaba nada de ella; el motor nuevo se queda en 11-16 MB
   con 1 MB o con 300, y sí conserva los primeros 64 kB.
3. **El tope global es lo único que el profesor espera.** Con máquina por
   alumno el escalado es casi perfecto, así que ese número se sube a 16
   (ADR-0013) y el resto queda en manos de `--concurrency`.

Queda sin medir lo que aún no existe: el tiempo hasta el primer evento NDJSON,
que depende del formato de eventos (D-9).
