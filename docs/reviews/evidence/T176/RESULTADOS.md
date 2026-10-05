# T176 · Retirada de la opción fichero

Petición expresa de Adrià. Base de retirada: `2c71d574982c4e6d062de21a231c103516caa329`.
Versión funcional recuperada: `fb3206b`, anterior a T173.
Decisión: [ADR-0029](../../../adr/0029-retirar-lecturas-compartidas.md).

## Cambios y comprobaciones

- Motor, parser, modelos del examen, formulario, traducción y pruebas del
  editor restaurados byte a byte desde `fb3206b`. También Makefile y guías
  activas: 13 archivos en total, comparación directa mediante `git show`.
- Retiradas fuentes `fichero`, agrupación de lecturas y caché; eliminados
  arneses, fixtures y pruebas exclusivos de la funcionalidad retirada.
  Las demás pruebas se conservan exactamente como estaban antes de T173.
- Evidencia T173–T175 y capturas conservadas y marcadas como históricas.
  ADR-0028 sustituido por ADR-0029; tareas previas anotan la retirada.
- `GOCACHE=/tmp/heimdall-plan-go-cache make check build`: correcto.
- `make gui-check gui-build`: correcto, 531 pruebas, TypeScript y preload.
  Ejecución fuera del aislamiento por el problema conocido de localhost.
- `make docs-check tools-check`: correcto; 70 documentos y 5 pruebas de herramientas.
- Examen `testdata/ra2` aceptado por el binario recompilado.
- Copia temporal del examen experimental: `fichero` rechazado como clave
  desconocida con exit 2 y sin crear `var/`. No se modifica ningún examen
  del usuario ni se inicia una conexión SSH.
- Búsqueda de restos en motor, GUI, pruebas, scripts y documentación activa:
  no hay símbolos, rutas de arneses ni declaraciones de la fuente retirada.
- Diff revisado y `git diff --check` correcto.

## Límites

No se levantaron laboratorios ni se repitió integración SSH en esta retirada.
El código funcional coincide exactamente con la versión previa a T173,
y se recompilaron motor y GUI. No se generan instaladores ni publicaciones.
Los resultados JSON ya guardados mantienen su formato y sus lectores.
