# ADR-0016 · Heimdall es un producto independiente, con GUI propia

- Estado: **aceptada** · 2026-09-20
- Sustituye a: [ADR-0008](0008-compat-teuton-temporal.md)
- Contexto: decisión del profesor (2026-09-20), `06-LEGACY-WRITER.md`, `GUI-CONTRACT.md`

## Contexto

ADR-0008 aceptaba un adaptador hacia los formatos de Teuton para no perder la
red de seguridad de la suite de la GUI durante el salto de motor. Esa red ya se
ha cobrado su precio: la fase 4 se convirtió en tres tareas (T043, T041, T044)
cuyo único producto es hacer que el motor nuevo se parezca al viejo. T043 exigía
que el motor aprendiera a leer `config.yaml` y `start.rb`; T044, a provocar
averías que el motor no comete.

Pasar la UAT de Teuton GUI deja de ser una prueba del motor y pasa a ser una
prueba de la imitación.

## Decisión

Heimdall no mantiene compatibilidad con Teuton. Ni de CLI, ni de ficheros, ni de
formatos, ni de proyectos.

1. **No se lee `start.rb` ni `config.yaml`.** No hay importador de exámenes
   antiguos. Los exámenes del curso se rehacen en el formato nativo.
2. **La cadena definitiva es** Heimdall GUI → contrato nativo → motor Heimdall →
   SSH → máquinas del alumnado. No hay ningún otro camino de entrada ni de
   salida del motor.
3. **La GUI es propia**: `gui/`, en este repositorio. Nace tomando `teuton-gui`
   como base técnica y visual —Electron, Vite, React, Tailwind, componentes,
   estilos, layouts y los tests que sigan valiendo— y se escribe su capa de
   motor directamente sobre el contrato nativo. De Teuton GUI se conserva la
   experiencia de uso, no su contrato: lista de alumnos, matriz de resultados,
   progreso de corrección, filtros, histórico, modo examen, presentación de
   notas y errores, analíticas.
4. **La capa legacy queda congelada.** `internal/legacy`, `--compat=teuton2` y
   la fachada `--export=json`/`--cname`/`--case` se conservan como herramienta
   de prueba interna, sin una funcionalidad nueva ni una dependencia más. El
   diseño nativo no la tiene en cuenta para nada. Se borra entera, en un commit
   propio, en cuanto la GUI nativa corra sobre el artefacto canónico con sus
   pruebas de integración en verde.
5. **Ninguna limitación de Teuton GUI condiciona el diseño.** El modelo real
   —`PASS`, `FAIL`, `UNEVALUATED`, causa técnica, resultados parciales,
   provisionales, avisos, progreso por comprobación— es lo que la GUI muestra.

## Consecuencias

- Se pierde la UAT de 40 escenarios como prueba de aceptación externa. La
  sustituye la suite propia de la GUI nueva sobre el contrato nativo, más los
  criterios de aceptación del motor, que nunca dependieron de la GUI.
- El contrato nativo motor ↔ GUI (D-9) deja de estar aplazado: pasa a ser lo
  primero, porque todo lo demás cuelga de él.
- Se retiran T041, T043 y T044. T042 se queda como está, en su sitio y
  congelada.
- La GUI vive en este repositorio: un solo release, contrato y consumidor
  siempre en la misma versión, a cambio de tener Go y Node en el mismo árbol.
- `docs/research/` sigue siendo evidencia histórica válida sobre qué falla y por
  qué; deja de ser una especificación de compatibilidad.
