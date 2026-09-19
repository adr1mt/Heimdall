# ADR-0001 · Go como lenguaje del motor

- Estado: **aceptada** · 2026-09-19
- Contexto: `PROPOSAL.md` §1, `GUI-CONTRACT.md` §3

## Contexto

Teuton es un gem de Ruby. La GUI necesita `gemBinDirs()`, un
`bash -lc command -v teuton` y una ruta manual en Ajustes solo para encontrar el
binario. El motor debe distribuirse a equipos de aula y ejecutarse desde
Electron con control fino de timeouts, cancelación y concurrencia.

## Decisión

El motor se escribe en Go, se distribuye como **un único binario estático** y se
lanza como subproceso desde Electron.

## Razones

- Binario único: desaparecen las tres piezas de andamio de la GUI.
- `context.Context` y goroutines dan cancelación y timeouts propagados, que es
  el principio 4 y lo que hoy falla (F-04, F-16).
- `golang.org/x/crypto/ssh` soporta claves OpenSSH modernas sin conversión a
  PEM (F-12).
- Compilación cruzada a Linux y Windows desde el mismo equipo.

## Consecuencias

- Hay que instalar Go: **no está en el equipo de trabajo**, y no existe ninguna
  medición del motor nuevo hasta que se instale.
- `known_hosts`, `ProxyJump` y `ssh_config` no vienen dados: se implementa
  `known_hosts`, `ProxyJump` solo si hace falta, `ssh_config` no.

## Alternativas descartadas

- **Seguir en Ruby**: arrastra el problema de distribución y el DSL ejecutable.
- **Node/TypeScript dentro de Electron**: fundiría motor y GUI justo cuando se
  quiere separarlos, y deja el motor inutilizable desde la CLI.
