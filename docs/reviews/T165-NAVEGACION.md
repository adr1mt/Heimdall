# T165 · Navegación y comprobaciones de agentes

Fecha: 2026-10-04. Base: `958d23a`.
Origen: [retrospectiva de diez sesiones](../retrospectives/2026-10-04-NAVEGACION.md).

## Cambios

- AGENTS dirige a las instrucciones existentes, estado, consulta selectiva,
  mapa de código/pruebas y guía de relevo.
- `scripts/tasks.py` consulta directamente TASKS: pendientes con prioridad y
  dependencias, salida JSON o tarea individual completa. Funciona desde otros
  directorios; un ID desconocido termina con código 2.
- README GUI remite al estado actual y respeta la persistencia cifrada de
  ADR-0023. Desarrollo localiza lectores, validadores, corpus, copias, sesiones,
  pantallas y actualizador. Se corrige el enlace ADR y la referencia de Go.
- T160 registra base/final, tareas revisadas, resultado y seguimiento T159;
  el informe recuperado identifica sus fuentes y límites históricos.
- `make docs-check` comprueba destinos locales en documentación mantenida;
  `make tools-check` verifica las herramientas con archivos temporales.
- CI ejecuta Go/version, tipos/tests GUI, build/preload y herramientas/enlaces.
  El objetivo por defecto de make sigue siendo check.
- La guía de tests registra EAI_AGAIN, comparación con la base y ejecución
  secuencial de arneses que comparten laboratorio.

## Verificación

- `make tools-check`: 5 pruebas correctas. Orden/dependencias, ID desconocido,
  consulta fuera de la raíz, preservación de criterios, enlaces/imágenes,
  exclusiones históricas y salida de error ante enlace roto.
- `make docs-check`: documentación mantenida sin destinos rotos.
- `python3 scripts/tasks.py --json`: JSON válido, solo tareas pendientes.
- `GOCACHE=/tmp/heimdall-retro-go-cache make check version`: correcto.
- `make gui-check gui-build`: tipos, **525 pruebas / 33 archivos**, build y
  preload correctos fuera del aislamiento. Dentro, Vitest no arranca por
  `getaddrinfo EAI_AGAIN localhost`; se mantiene su configuración original.
- Workflow YAML parseado y comprobados eventos, permisos y estructura de jobs.
- `git diff --check`: correcto.

## Límites

El workflow está preparado localmente; no se ha ejecutado en GitHub ni se ha
publicado este cambio. Su primera ejecución remota ocurrirá tras el push.
No se ejecutaron laboratorios SSH ni empaquetado: no cambió código del producto.
El comprobador no comprueba anclas ni enlaces externos y excluye documentos
históricos con rutas de otras máquinas. No puede detectar contradicciones
semánticas: el README se contrastó con ADR-0023 y la implementación existente.
