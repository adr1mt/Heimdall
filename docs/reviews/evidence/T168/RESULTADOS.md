# T168 · Memoria de las copias automáticas

Fecha: 2026-10-04. Base: `7fd7948`. Un resultado real del motor generado por
el arnés T166 (`n30-s65536`, 30 alumnos × 20 comprobaciones, 6.358.529 bytes)
se replicó como 50 correcciones independientes. Todo se ejecutó en `/tmp`.

Para repetirlo desde la raíz, generar primero un resultado con
`python3 docs/reviews/evidence/T166/reproduce_engine.py` y escoger el
`run-*.json` de `n30-s65536/var`. Para el arnés de T168:

```bash
gui/node_modules/.bin/esbuild docs/reviews/evidence/T168/verify_backup.ts --bundle --platform=node --format=cjs --outfile=/tmp/heimdall-t168-verify.cjs
node --expose-gc --max-old-space-size=128 /tmp/heimdall-t168-verify.cjs /ruta/al/run-SINTETICO.json
```

El arnés original T166 se compila igual y recibe además el argumento `50`.

## Reproducción F2 y comparación

Se compiló y ejecutó el arnés sin modificar
`docs/reviews/evidence/T166/reproduce_backup.ts` con Node `--expose-gc`.
Cada fila mide justo después de `backupRuns`; el RSS máximo de la segunda
pasada es acumulado del mismo proceso, no el consumo aislado de esa llamada.

| Código | Pasada | Nuevas copias | Heap ocupado después | RSS máximo hasta entonces |
|---|---:|---:|---:|---:|
| Antes | 1 | 50 | 342.758.008 B | 516.704 KiB |
| Antes | 2 | 0 | 341.604.264 B | 611.088 KiB |
| T168 | 1 | 50 | 53.705.760 B | 308.080 KiB |
| T168 | 2 | 0 | 57.867.168 B | 338.544 KiB |

La segunda pasada reduce el heap ocupado tras la llamada un 83 % en esta
muestra. `--max-old-space-size=128` también completó las dos pasadas: 50 y
0 copias, sin fallos. Este límite de V8 no es un límite de RSS ni una garantía
para todos los tamaños posibles.

## Notas y recuperación

`verify_backup.ts` recorre el código de producción con los mismos 50 originales.
Se ejecutó compilado con esbuild y Node `--expose-gc --max-old-space-size=128`:
primera pasada 50, segunda 0, cero fallos; comparó cada copia completa con
`gradesOnly(original)`; eliminó la carpeta de originales y restauró las 50
copias, con bytes idénticos a las copias validadas. Heap ocupado tras las
pasadas: 27.861.248 y 26.259.456 bytes. Las pruebas de copias verifican además
rotación y antecedentes; `shutdown.test.ts` verifica cierre con copia pendiente.

Comprobaciones del repositorio: `make check`, `go test -race ./...`,
`make test`, `make gui-check gui-build` (526 pruebas), `make gui-lab`,
`make docs-check tools-check` y `git diff --check`. La suite GUI se ejecutó
fuera del aislamiento porque dentro Vitest no podía resolver `localhost`.

## Límites

Son resultados sintéticos y muestras de una máquina, no percentiles ni
predicción de un aula real. La segunda pasada sigue leyendo y validando cada
original para detectar corrupción o cambios de PLAN y respetar su precedencia;
la mejora consiste en descartar su evidencia de la memoria de la pasada.
Los errores de listado y lectura ya registrados como F3 quedan para T169.
