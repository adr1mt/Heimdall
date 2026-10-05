# T172 · Higiene del repositorio

Base local `ffc8dec`; GitHub `main` estaba en `572d9eb` y contenía una sola
rama, ningún PR abierto y la versión publicada `v0.9.1`. La última ejecución
visible de `Checks` en esa base había terminado correctamente.

## Auditoría T166

Los cuatro hallazgos confirmados tienen reparación y evidencia separadas:
F1 → T167, F2 → T168, F3 → T169, F4 → T170 y T171. No queda una reparación de
F1–F4 abierta en `TASKS.json`. El informe T166 conserva límites de
certificación: no prueba recuperación de parciales desde la GUI, durabilidad
ante pérdida de alimentación ni un examen real con alumnado. T070/T084 cubren
la prueba de aula; esos límites no se presentan como fallos corregidos.

## Retirado y conservado

- Se eliminaron los seis archivos de `testdata/legacy/`: eran ficheros de
  referencia de `internal/legacy`, borrado en T060; ninguna prueba ni ruta
  activa los usaba.
- Se retiraron la función visual sin uso `ComingSoon` y un tipo importado que
  no se usaba. TypeScript comprobó los tres proyectos con
  `noUnusedLocals` y `noUnusedParameters`; las mismas opciones quedan en sus
  configuraciones y entran en el `typecheck` de CI.
- El arnés vivo de aceptación ya no imprime A-10 como `PEND`: ese criterio
  pertenece al formato antiguo, retirado en T060. Conserva los 13 criterios
  vigentes. Su salida histórica en `docs/design/ACEPTACION-FASE1.md` queda
  intacta y se distingue de la salida del arnés actual.
- Se conservaron ADR, auditorías, `docs/research/`, pruebas reales, paquetes
  0.9.1 y repositorios de referencia. Los instaladores locales ignorados de
  0.1.0/0.9.0 y la carpeta de empaquetado temporal se borraron; se liberaron
  aproximadamente 786 MiB fuera del árbol versionado.

## Verificación

- `make check`: correcto, con `GOCACHE` temporal por el aislamiento.
- `make gui-check gui-build`: 531 pruebas, tipos y compilación correctos. Vitest
  necesitó ejecutarse fuera del aislamiento por `EAI_AGAIN localhost`.
- `test/acceptance.sh` contra el laboratorio SSH: 13 criterios vigentes
  correctos y ninguna línea `PEND`; el laboratorio se apagó después.
- `make docs-check tools-check`, `bash -n test/acceptance.sh` y
  `git diff --check`: correctos.

No se cambiaron notas, aserciones, formato canónico ni comportamiento SSH.
