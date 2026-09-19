# ADR-0002 · Fase PLAN antes de tocar ninguna máquina

- Estado: **aceptada** · 2026-09-19
- Contexto: `PROPOSAL.md` §2, F-02, F-06, `c14-check`

## Contexto

En Teuton el plan se descubre **mientras** se ejecuta, porque el examen es
código. Consecuencias medidas: un typo borra una comprobación y encoge el
denominador con exit code 0 (F-02); dos alumnos acaban con denominadores
distintos y la misma nota (`c14-check`); `teuton check` declara 3 targets y la
ejecución produce 4.

## Decisión

Una fase **PLAN** obligatoria resuelve examen × inventario en una lista fija y
numerada de comprobaciones **antes** de abrir ninguna conexión. Valida todo lo
validable y publica `check_count`, `total_weight`, `check_ids` y los hashes. Si
el PLAN falla, no se toca ninguna máquina y se sale con código 2.

## Consecuencias

- El denominador queda fijado antes de la ejecución y nada puede encogerlo.
- El total de comprobaciones es exacto y se puede anunciar: la GUI deja de
  adivinarlo.
- El examen deja de poder ser código: ver ADR-0003.
- `check` pasa a ser fiable en vez de una estimación.
