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

5. **`internal/legacy` es capa temporal.** Solo la lee `--compat=teuton2`, solo
   escribe hacia fuera, nunca influye en el cálculo de la nota y nunca se le
   añade nada que la UAT de la GUI no exija. Se borra entera cuando la GUI
   consuma el artefacto canónico.

6. **El artefacto canónico se escribe siempre**, con o sin `--compat`, incluso
   con cancelación o con todos los alumnos rotos. Única excepción: PLAN inválido.

7. **No hay shell.** Los comandos son vectores de argumentos. No se construyen
   cadenas de comando, no se interpola en cadenas que vayan a un intérprete, no
   se añade `shell: true`.

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
internal/legacy/ LegacyTeutonWriter (temporal)
testdata/        exámenes e inventarios de prueba
test/            scripts de aceptación e integración
```

No se crean paquetes nuevos de primer nivel sin justificarlo en la tarea.

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
el examen. Si aparece la necesidad, se abre un ADR; no se implementa de paso.
