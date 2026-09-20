# ADR-0014 · El producto se llama Heimdall

- Estado: **aceptada** · 2026-09-20
- Cierra **D-7** de `08-DECISIONES-ABIERTAS.md`
- Decisión del autor del proyecto

## Contexto

`Evalon` era un nombre de trabajo, marcado como provisional desde el primer
día. D-7 pedía cerrarlo antes de que saliera del equipo el primer binario. El
nombre aparece en tres sitios que cuesta cambiar más tarde: el módulo Go, el
nombre del binario y todo lo que el profesorado vea escrito.

La fase 3 termina sin binario publicado y sin GUI adaptada. Es el momento más
barato para cambiarlo: no hay nada fuera que dependa del nombre.

## Decisión

El motor se llama **Heimdall**, por el guardián de la mitología nórdica, que
vigila sin descanso.

Alcance del cambio:

- módulo Go `heimdall`, CLI en `cmd/heimdall`, binario `bin/heimdall`;
- toda la documentación y los scripts de prueba;
- `docs/research/` **no se toca**: es evidencia histórica y sus rutas y salidas
  son las que se capturaron.

El nombre deja de ser provisional. No se vuelve a discutir sin evidencia nueva.

## Consecuencias

- Las rutas de import cambian en todo el módulo. `make check` pasa igual.
- Los artefactos de correcciones anteriores hechas con el nombre viejo siguen
  siendo válidos: el nombre no entra en el modelo canónico ni en la nota.
- La carpeta del repositorio y el repositorio remoto, si llega a existir, usan
  el nombre nuevo.
