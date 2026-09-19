# Registro de decisiones

Bitácora ligera. **No sustituye a los ADR**: las decisiones arquitectónicas
viven en [`../adr/`](../adr/) y las que siguen abiertas en
[`../design/08-DECISIONES-ABIERTAS.md`](../design/08-DECISIONES-ABIERTAS.md).
Aquí se anotan, en una o dos líneas, las decisiones tomadas durante la
ejecución que no llegan a ADR, y los cambios de estado de las que sí.

## Cuándo hace falta un ADR

Si la decisión afecta a los límites del sistema, al modelo de resultados, a las
dependencias, al contrato con la GUI o a cualquiera de los 12 principios:
**ADR**. Si es una elección local reversible dentro de una tarea: una línea
aquí.

Para cambiar una decisión aceptada: ADR nuevo que la sustituya, con la
evidencia. Nunca se edita un ADR aceptado en silencio.

## Estado de las decisiones abiertas

| # | Decisión | Se cierra en |
|---|---|---|
| D-2 | SSH nativo vs. delegar en el binario `ssh` | T013 (fase 1) |
| D-3 | Política de `known_hosts` | T021 (fase 2), antes del primer examen real |
| D-5 | Detección de valores repetidos (anticopia) | Cuando haya un caso real; no bloquea |
| D-6 | Números de concurrencia por defecto | T031 (fase 3) |
| D-7 | Nombre del producto | T070 (fase 7), antes de que salga un binario del equipo |
| D-8 | Presentación de `INCOMPLETE` en la GUI | T060 (fase 6) |
| D-9 | Formato definitivo de los eventos NDJSON | T050 (fase 5) |

## Bitácora

### 2026-09-19 · Estructura de proyecto persistente

Se convierte la investigación y el diseño cerrados en `CLAUDE.md`,
`.claude/rules/`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md` y `docs/project/`.
Ninguna decisión de producto cambia: la documentación existente se indexa, no se
reescribe.

Tres decisiones menores:

1. `HANDOFF.md` pasa a ser un puntero a `docs/project/PROGRESS.md`. Dos ficheros
   con el mismo cometido producen dos estados distintos.
2. El informe de auditoría suelto en la raíz se archiva como
   `docs/research/00-AUDITORIA-INICIAL.md`.
3. La fase 2 del roadmap incluye el formato completo (`cerca_de`, `valor:`,
   `no_contiene`) y no solo la robustez de SSH: sin esas tres primitivas no se
   puede ejecutar un examen real del curso, que es su condición de salida.

### 2026-09-19 · T001 · Toolchain Go

El módulo existe y compila. Tres decisiones operativas, ninguna arquitectónica:

1. **Go 1.27.1 del tarball oficial**, extraído en
   `/mnt/datos/Applications/Claude/toolchains/go`. `apt` ofrece 1.22 —justo el
   mínimo—, exige root e instala en `/usr`, fuera del árbol del proyecto.
2. **`go.mod` declara `go 1.22`, no la versión instalada.** El mínimo del
   proyecto es lo que debe compilar en cualquier equipo, no lo que hay aquí.
3. **El exit code 1 queda sin significado**, reservado como fallo no
   especificado, y hay un test que lo protege junto a los otros cuatro. La GUI
   distingue configuración inválida (2) de ejecución parcial (3) por el número.

### 2026-09-19 · T002 · Serialización canónica sin escape HTML

El artefacto se escribe con un `MarshalCanonical` propio (sangría de dos
espacios, `SetEscapeHTML(false)`) en lugar de `json.Marshal`. Motivo: la salida
de `ip address show` y cualquier comando con `<`, `>` o `&` debe leerse en el
artefacto tal como se envió a la máquina, no como secuencias escapadas. Es una
elección local y reversible; no cambia el modelo.

El golden del round-trip vive en `internal/model/testdata/`, no en el
`testdata/` raíz que cita `architecture.md`: `go test` lo lee por ruta relativa
al paquete. El raíz queda para exámenes e inventarios de prueba.

### 2026-09-19 · T003 · Holgura al comparar pesos y errores del motor explícitos

Dos elecciones locales dentro del cálculo de la nota:

1. Los pesos acumulados se comparan con cero con una holgura de `1e-9`. Un
   examen de 0,1 + 0,2 + 0,7 deja un residuo de coma flotante del orden de
   `1e-16` en `total - evaluable`; sin la holgura ese residuo se leería como
   «queda algo sin evaluar» y negaría la nota final a un alumno que la merece.
   Cualquier peso real está muchos órdenes de magnitud por encima.
2. `Classify` con causa `NONE` pero sin ejecución completa, sin código de
   salida o sin aserción devuelve `UNEVALUATED` con causa `ENGINE_ERROR`, no un
   `PASS` ni un `FAIL`. Es una contradicción del motor, y el principio 2 pide
   que se vea.

`Classify` devuelve además un `detail` por defecto para cada causa. El motor
puede sustituirlo por uno más concreto, nunca por vacío: una comprobación
`UNEVALUATED` sin explicación deja al profesor sin saber qué hacer.
