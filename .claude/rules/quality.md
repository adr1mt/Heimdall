# Reglas de calidad

## Antes de tocar código

1. Lee el código que vas a modificar. No especules sobre lo que no has leído.
2. Escribe los criterios verificables **antes** de implementar. Si la tarea no
   los trae en `acceptance`, es que la tarea está mal definida: arréglala
   primero.

## Tests

- **Tests rápidos** (`make check`): lógica pura, sin red ni disco. Deben tardar
  segundos. `internal/model`, `internal/plan`, `internal/assert` son
  íntegramente de este tipo.
- **Tests de integración** (`make test`): SSH y red, contra el laboratorio
  podman. Separados por build tag `integration` para que nunca bloqueen el ciclo
  rápido.
- **Tests de aceptación** (`test/acceptance.sh`): comprueban los criterios del
  hito con `jq` sobre el artefacto real. Nada «a ojo».

Reglas duras:

- No se elimina ni se debilita un test para que pase una implementación.
- No se implementa una solución cuyo único propósito sea satisfacer un test
  concreto. El test verifica el diseño; no lo define.
- Un fallo de test se reporta tal cual, con su salida. No se da por funcionando
  nada que no se haya ejecutado.
- Toda tabla de estados y causas se testea de forma **exhaustiva**, no con
  ejemplos: para cada causa ≠ `NONE`, el estado resultante es `UNEVALUATED`.

## Simplicidad

- No abstraigas algo que se usa una sola vez.
- No añadas opciones de configuración sin un caso de uso demostrado.
- No implementes funcionalidad de fases posteriores.
- No hagas refactors ajenos a la tarea. Si ves uno necesario, anótalo como
  tarea nueva en `TASKS.json`.
- No añadas dependencias sin necesidad clara (ver `architecture.md`).

## Alcance de la sesión

Un paquete de GUI o producto por sesión; una sola tarea por sesión en las
áreas críticas. Las condiciones y la lista de áreas están en `CLAUDE.md`
(«Seleccionar la tarea»).

Los commits se separan cuando aíslan el cambio, y siempre en las áreas
críticas. El repositorio queda en estado válido después de cada uno.

Si una tarea crece: divídela en `TASKS.json`, implementa una parte coherente y
deja el repositorio en estado válido.

## Errores

- Ningún error silencioso. Un fallo del motor es `ENGINE_ERROR` con `detail`,
  visible en el artefacto, nunca un valor por defecto.
- Los mensajes de error de configuración llevan **fichero y línea**.
- Nada de trazas de pila en el artefacto.
- Los exit codes son discriminantes: `0` todo evaluado · `2` configuración
  inválida · `3` ejecución parcial · `4` cancelado.

## Git

- Un commit local por tarea terminada, conventional commits en inglés.
- Una tarea `DONE` equivale a un estado coherente del repositorio.
- Nunca `push`, `force-push`, tags, releases ni cambios en remotos sin
  instrucción explícita. No se reescribe historia publicada.
- Los repositorios de referencia (`workspace/teuton`, `workspace/teuton-gui`) no
  se modifican salvo que la tarea sea adaptar la GUI y se trabaje en su rama.

## Independencia del entorno

La nota no puede depender del idioma, la configuración regional ni el sistema
del profesor (F-08). No se comparan mensajes del sistema ni salidas
localizadas; las aserciones se escriben sobre datos estables.
