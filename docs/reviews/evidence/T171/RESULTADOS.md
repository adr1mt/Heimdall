# T171 · Huella del PLAN con memoria acotada

Base: `3f0ce82`. Caso sintético sin SSH de T166: 100 alumnos × 20
comprobaciones, con una respuesta de inventario de 65536 bytes reutilizada
en cada una. La huella conserva el mismo JSON lógico y los mismos bytes que
antes; ahora se calcula por comprobación, sin construir una copia completa de
~125 MiB.

| Medición | Antes | Después |
|---|---:|---:|
| Asignaciones de `hashPlan` en una pasada | 793731376 bytes | 151619896 bytes |
| Tiempo de `hashPlan` en una pasada | 336,5 ms | 284,8 ms |
| Heap tras cargar el PLAN (sin forzar GC) | 541677208 bytes | 220114616 bytes |
| Asignaciones acumuladas tras cargar el PLAN | 1084914720 bytes | 333941264 bytes |
| RSS máximo al cargar, ejecutar y guardar final | 805208 KiB (786 MiB) | 297688 KiB (291 MiB) |

El perfil de asignaciones antes atribuía ~631 MiB a la construcción del JSON
completo y ~125 MiB a su copia. Después, el mayor coste son copias de los JSON
individuales de 65536 bytes, sin un gran buffer del PLAN. Las mediciones son
muestras de esta máquina; el arnés completo incluye carga, ejecución sintética
y guardado final. No se ejecutó SSH.

`TestPlanHashPreservesExistingBytes` fija dos huellas producidas antes del
cambio: un proyecto válido y un PLAN con orden distinto, alumno excluido y
caracteres que requieren escape. Siguen pasando las regresiones de cambio de
preguntas, límites de 2000 celdas, metadatos y respuestas, reintentos,
sesiones, además de `make check` y `go test -race ./...`. La validación sigue
ocurriendo antes de abrir conexiones.
