# Relevo y revisión entre sesiones

## Implementación

Lee [PROGRESS.md](PROGRESS.md) para el presente y consulta la tarea completa
con `python3 scripts/tasks.py T165` desde la raíz. Para elegir trabajo, usa
`python3 scripts/tasks.py`. Localiza código y pruebas en
[DESARROLLO.md](../DESARROLLO.md#entradas-por-trabajo); consulta DECISIONS por el
encabezado de la tarea cuando necesites su historia.

Al cerrar, actualiza el estado y criterios de TASKS y deja en PROGRESS el
resumen y un enlace a la evidencia. Una revisión pendiente se representa como
una tarea con estado propio; al terminar, su resultado e informe quedan en esa
tarea, aunque haya reparaciones posteriores.

## Revisión

Antes de revisar, registra en el campo `review` de la tarea:

- `base`: SHA completo anterior a la implementación.
- `head`: SHA completo del último commit incluido.
- `includes_uncommitted`: si también se revisan cambios locales; al cerrar,
  el informe identifica esos archivos y el estado que se examinó.
- `task_ids`: tareas cuyo comportamiento se revisa.
- `report`: ruta relativa al repositorio del informe.
- `status`: `PENDING` hasta emitir resultado, después `COMPLETE`.

El informe identifica criterios, resultado, comprobaciones y límites. Las
incidencias preexistentes se separan de las introducidas en el intervalo;
se enlazan sus tareas de reparación. T160 conserva un ejemplo de revisión
cerrada. Un informe histórico no certifica automáticamente el HEAD actual.

Cuando el usuario limita la sesión a solo lectura, conserva ese alcance y
entrega estos datos en el relevo sin escribir al repositorio.

## Prompt para la siguiente sesión

Incluye tarea elegida, base/final conocidos, estado de cambios locales,
comprobaciones ejecutadas y límites. Usa rutas completas relativas a la raíz:
`docs/project/PROGRESS.md` y `docs/project/TASKS.json`.
Enlaza el informe pertinente y el siguiente criterio verificable. El relevo
remite a esas fuentes; no sustituye el backlog por una segunda lista.
