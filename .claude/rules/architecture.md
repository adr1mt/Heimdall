# Reglas de arquitectura

Vinculantes en toda sesión. Complementan [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md),
que describe el sistema; esto describe **qué no se puede hacer**.

## Límites que no se cruzan

1. **Las capas leen hacia atrás, nunca hacia delante.**
   `ExecutionResult` → `AssertionResult` → `CheckResult` → `Score`.
   `Score` solo mira `CheckResult.Status` y `Weight`. Ningún tipo de una capa
   conoce a la siguiente. Si un error técnico tuviera un camino hasta la nota,
   la arquitectura estaría rota, no el caso de prueba.

2. **`model.Classify` y `model.ComputeScore` son funciones puras.** Sin red, sin
   disco, sin reloj, sin `os.Getenv`. Ahí viven los tests que protegen la nota.

3. **El PLAN se resuelve entero antes de abrir la primera conexión.** Un fallo
   de validación termina el proceso con exit 2 sin tocar ninguna máquina ni
   escribir en `var/`.

4. **El PLAN es inmutable durante la ejecución.** `check_ids`, `weights` y
   `total_weight` son los mismos para todos los alumnos. Nada de lo que ocurra
   en una máquina puede alterarlos.

5. **No hay capa de compatibilidad.** `internal/legacy`, `--compat` y la
   fachada del motor viejo se borraron en T060 (ADR-0016). No se reintroducen:
   ni un fichero, ni una bandera, ni un formato de salida de Teuton.

6. **El artefacto canónico se escribe siempre**, incluso
   con cancelación o con todos los alumnos rotos. Única excepción: PLAN inválido.

7. **Comandos como vectores literales.** No hay shell local ni `shell: true`.
   SSH entrecomilla cada argumento para el shell del servidor. Única excepción
   remota: el supervisor de texto fijo de ADR-0024, que invoca `"$@"` sin
   interpolar los argumentos del examen dentro del programa.

8. **El motor no convierte la nota a la escala del profesor.** Publica 0-100
   entero y los números crudos. La conversión es de la GUI.

## Dependencias

Permitidas en el módulo Go: `golang.org/x/crypto/ssh`, un parser YAML
(`gopkg.in/yaml.v3`), un generador de ULID. **Cualquier otra requiere un ADR.**

## Estructura del módulo

```
cmd/heimdall/      CLI
internal/plan/   YAML, validación, resolución del PLAN
internal/model/  tipos canónicos y funciones puras de nota
internal/ssh/    sesión, exec, límites de salida, timeouts
internal/engine/ worker pool, presupuesto por alumno, cancelación
internal/assert/ aserciones
internal/report/ escritura atómica del artefacto
internal/events/ contrato nativo NDJSON hacia la GUI
testdata/        exámenes e inventarios de prueba
test/            scripts de aceptación e integración
gui/             Heimdall GUI (Electron, TypeScript)
```

No se crean paquetes nuevos de primer nivel sin justificarlo en la tarea.

`gui/` es un árbol Node independiente del módulo Go: `make check` no depende de
él y su suite se ejecuta aparte. La GUI habla con el motor **solo** por el
contrato nativo —argumentos, secretos por stdin, eventos NDJSON y artefacto
canónico—; nunca lee un fichero de Teuton.

## Cambiar una decisión

1. No edites el ADR antiguo.
2. Crea un ADR nuevo que lo sustituya, con la evidencia que lo motiva.
3. Marca el antiguo como `sustituida por ADR-00NN` en una sola línea.
4. Anótalo en `docs/project/DECISIONS.md`.

Las decisiones abiertas están en
[docs/design/08-DECISIONES-ABIERTAS.md](../../docs/design/08-DECISIONES-ABIERTAS.md).
Una decisión cerrada no se rediscute sin evidencia nueva.

## Fuera del núcleo

Telnet, monitorización, correo, SFTP, macros, `ProxyJump`, detección de copias,
DSL ejecutable, expresiones regulares en aserciones, condicionales y bucles en
el examen. Y, desde ADR-0016: leer `config.yaml` o `start.rb`, importar
exámenes de Teuton y cualquier compatibilidad nueva con el motor viejo. Si aparece la necesidad, se abre un ADR; no se implementa de paso.
