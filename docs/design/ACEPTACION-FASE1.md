# Aceptación de la fase 1 — salida real

Evidencia del cierre de la rebanada vertical (T012). Los criterios están
especificados en [07-PROTOTIPO.md](07-PROTOTIPO.md) §6; aquí solo va la salida
literal de `test/acceptance.sh`, para no juzgar nada a ojo.

Reproducible con el laboratorio levantado:

```bash
make lab && make build && test/acceptance.sh
```

**Fecha**: 2026-09-20 · **Go 1.27.1** · podman, `alu1` en `127.1.2.3:2201`.

```
OK     A-1   los dos alumnos reciben las mismas 5 comprobaciones
OK     A-1   los dos alumnos se miden sobre el mismo peso total
OK     A-1   los dos alumnos reciben la misma lista de comprobaciones
OK     A-2   ninguna causa técnica produce un suspenso
OK     A-3   con algo sin evaluar no hay nota final
OK     A-3   con algo sin evaluar la nota está INCOMPLETE o NOT_EVALUATED
OK     A-4   el alumno con la máquina accesible tiene 3 o más comprobaciones evaluadas
OK     A-4   el alumno del puerto cerrado sale entero con CONNECT_FAILED
OK     A-4   el artefacto contiene a los dos alumnos
OK     A-4   la ejecución parcial sale con exit 3, no con 1
OK     A-5   el run completo termina en 0:04.44 (< 90 s) con un sleep 30 y un host inalcanzable dentro
OK     A-5   la comprobación lenta corta a su timeout (3005 ms entre 3000 y 5000)
OK     A-5   la comprobación lenta sale UNEVALUATED por TIMEOUT
OK     A-7   el secreto no aparece en var/ ni en la salida del terminal
OK     A-7   el secreto no aparece en /proc/<pid>/cmdline con el proceso vivo
OK     A-8   toda comprobación evaluada trae aserción y código de salida
OK     A-8   toda comprobación sin evaluar trae causa y explicación
OK     A-11  el transporte es ssh, no ejecución local
OK     A-11  el hostname devuelto es el del contenedor
OK     A-14  el comando inexistente suspende, no avería
OK     A-6   la salida enorme queda marcada como truncada
OK     A-6   se conservan 64 kB como máximo
OK     A-6   se contabiliza todo lo que produjo el comando
OK     A-6   la memoria del motor se queda en 13 MB (< 100 MB)
OK     A-9   el parcial de un run matado trae al menos un alumno terminado
PEND   A-10  artefactos legacy (resume.json, case-NN.json): los escribe T040, fuera de la fase 1
OK     A-12  el mismo examen bajo es_ES.UTF-8 y bajo LC_ALL=C da notas idénticas
OK     A-13  una clave desconocida sale con exit 2
OK     A-13  el error dice el fichero y la línea
OK     A-13  una clave desconocida no crea nada en var/
OK     A-13  una clave desconocida no abre ninguna conexión al contenedor

acceptance: los 13 criterios de la fase 1 en verde (A-10 pendiente de T040)
```

## A-10, el único pendiente

A-10 pide los artefactos `resume.json` y `case-NN.json` del formato viejo, que
los escribe `internal/legacy`. Ese paquete es de la fase 3 (T040) y la fase 1 lo
declara explícitamente fuera de alcance, así que el criterio queda marcado
`PEND` en el script en vez de verde. No es uno de los cinco que protegen la
integridad de la nota (A-1, A-2, A-3, A-8, A-14): esos cinco están en verde.

El script vuelve a dar A-10 en verde en cuanto T040 exista; hasta entonces
`PEND` no rompe el exit code.

## Mediciones

| Qué | Medido |
|---|---|
| Run completo del prototipo (2 alumnos, `sleep 30`, host inalcanzable) | 4,4 s |
| Memoria máxima del motor con 300 MB de salida de un alumno | 13 MB |
| Corte de la comprobación con `timeout: 3s` | 3005 ms |

### Escalado por tamaño de salida (T013)

`PERFORMANCE.md` §6 punto 2, medido el 2026-09-20 con `/usr/bin/time -v` sobre
un examen de una sola comprobación que vuelca N MB por stdout. La memoria del
motor debe quedar **plana**: lo que escupe el alumno es dato no confiable y no
puede entrar entero en el proceso.

| Salida del alumno | RSS máximo | Leído antes del corte | Conservado |
|---|---|---|---|
| 1 MB | 13,4 MB | 1,0 MB (entero) | 64 kB |
| 20 MB | 13,1 MB | 8,4 MB | 64 kB |
| 100 MB | 13,8 MB | 8,4 MB | 64 kB |
| 300 MB | 15,5 MB | 8,4 MB | 64 kB |

En los tres últimos casos el lector corta en seco y el proceso remoto queda
`UNKNOWN`; `bytes_total` refleja lo leído, no lo prometido. Trescientos veces
más salida cuestan 2 MB de RSS.

### Tiempo hasta que la GUI puede pintar algo (T013)

`PERFORMANCE.md` §6 punto 4, parcialmente: los eventos NDJSON no existen aún
(D-9), así que se mide el artefacto parcial, que es lo que hoy puede leer la
GUI. Prototipo de dos alumnos, uno de ellos inalcanzable.

| Hito | Desde el arranque |
|---|---|
| Primer artefacto parcial en `var/` | 3,2 s |
| Artefacto definitivo | 4,6 s |

Los puntos 1 y 3 de `PERFORMANCE.md` §6 (10/30/100 alumnos) siguen pendientes:
necesitan más de dos máquinas y son de la fase 3.
