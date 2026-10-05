# T169 · Errores de lectura visibles

Fecha de cierre: 2026-10-05. Base: `36e869d`, árbol limpio. F3 de la auditoría T166
se reprodujo con su arnés original y un resultado válido del motor de
`n30-s65536/var`, usando una copia para evitar trabajo de carga innecesario.

## Antes del cambio

`reproduce_backup.ts` informó `rows: []` tanto para el histórico como para la
carpeta de copias con permisos retirados. Con una copia corrupta devolvió
`listed: []` y restaurar respondió «No hay ninguna copia de seguridad de este
examen». El archivo seguía allí. Las nuevas regresiones de permisos y mezcla
de archivos fallaron antes del arreglo con esos mismos síntomas.

## Después del cambio

`verify_read_errors.ts` ejercita los lectores y la restauración de producción
con carpetas temporales, permisos reales y alumnado ficticio. Se ejecutó como
usuario sin privilegios. Resultado:

- Una carpeta de resultados o copias sin permiso informa `EACCES` y su ruta.
- Una copia válida se muestra junto a la copia corrupta, cuya ruta y causa se
  ven sin ofrecerla para recuperar.
- La copia válida se restaura; la dañada se omite, se comunica y queda intacta.
- Si solo queda la copia dañada, restaurar cita su archivo en lugar de afirmar
  que no hay copias.
- Una cadena inválida se omite; otra cadena independiente y válida se puede
  recuperar. Se mantiene el orden de antecedentes y nunca se publica la
  cabecera de una cadena rota.

Para repetirlo, generar primero un `run-*.json` válido con
`python3 docs/reviews/evidence/T166/reproduce_engine.py` y elegir uno de
`n30-s65536/var`. Compilar el arnés con esbuild y ejecutarlo sin `sudo`:

```bash
gui/node_modules/.bin/esbuild docs/reviews/evidence/T169/verify_read_errors.ts --bundle --platform=node --format=cjs --outfile=/tmp/heimdall-t169-verify.cjs
node /tmp/heimdall-t169-verify.cjs /ruta/al/run-SINTETICO.json
```

El arnés T166 sin adaptar se detiene ahora al primer error explícito de
permisos; el arnés T169 comprueba todos los casos por separado. Los archivos
de prueba se crean y eliminan en `/tmp`.

## Comprobaciones y límites

`gui-check` pasó 531 pruebas de 33 archivos, con tipos y `gui-build` correctos.
Pasaron también las 57 pruebas focalizadas de histórico, copias y recuperación,
`make check`, `go test -race ./...`, `make test` completo y `make gui-lab`
(histórico, copia y restauración en Electron), más `make docs-check tools-check`
y `git diff --check`. La GUI se probó fuera del
aislamiento por el fallo conocido de resolución de `localhost` en Vitest.
Los errores de permiso se comprobaron en Linux como usuario sin privilegios;
las pruebas no simulan todos los posibles fallos físicos de disco. El
histórico sigue limitado a 50 resultados recientes; los anteriores permanecen
en disco y se abren manualmente.
