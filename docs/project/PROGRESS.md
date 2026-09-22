# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-22 · **Fase**: 6 — Realineación de producto

## Última sesión

**T126 · La contraseña del aula se escribe una vez.** Toca secretos: tarea
sola, un commit.

- Se guarda **cifrada** con `safeStorage` en un fichero propio del directorio
  de datos, al escribirla, sin preguntar y sin casilla que marcar. Al abrir
  «Corregir» la casilla sale rellena.
- **Una sola casilla**: la pantalla pide «la contraseña de las máquinas» y el
  valor se aplica a todas las credenciales del aula generada. Los nombres en
  mayúsculas salieron de la pantalla (era la primera mitad de T123).
- **Ajustes** dice si hay una guardada y lleva «Olvidar la contraseña
  guardada», con confirmación. Sin cifrado disponible no se guarda nada y se
  sigue tecleando: no hay respaldo en claro.
- **ADR-0023** sustituye el punto 4 de ADR-0021. ADR-0009 no cambia: la
  contraseña no entra en el aula, ni en `argv`, ni en el artefacto, ni en
  ningún informe.

## Estado actual

- **Go 1.27.1** en `/mnt/datos/Applications/Claude/toolchains/go`; en shell no
  interactiva hay que exportar el `PATH` a mano. `go.mod`: `module heimdall`.
- `cmd/heimdall`: `check`, `run`, `consolidate`, `session`, `version`, con
  `--secrets`, `--events=ndjson`, `--retry`, `--session`, `--cname`. Exit: 0 · 2 config ·
  3 parcial · 4 cancelado · 1 sin escribir.
- Motor completo y probado: `model` puro, `plan` con sus nueve validaciones,
  `assert`, `report` atómico, `events`, `engine` y `ssh` (ADR-0011).
- `test/lab.sh`: `alu1` en `127.1.2.3:2201`, el roto en el 2299. `acceptance.sh`,
  `eventos.sh`, `sesion.sh`.
- `gui/`: árbol Node independiente; `make gui-check` (343 tests), `gui-build`,
  `gui-lab`, **`gui-editor`**. **Las nueve secciones están construidas**:
  Inicio, Clases, El examen, Corregir, Resultados, Analíticas, Histórico,
  Ajustes y Ayuda. Proyector: vista completa aparte. En el directorio de
  datos de usuario: `classes.json` (ADR-0021) y `projects.json`; de cada clase
  sale su aula dentro de la carpeta del examen (ADR-0022).

## Pruebas ejecutadas

`make check` y `make gui-check` (352) verdes, `typecheck` verde. Contra el
laboratorio, con la aplicación construida: `make gui-lab` (S-0…S-4, H-1, X-1,
X-2, **B-1…B-3**), `make gui-editor` (D-1…D-7) y el modo examen entero
(E-1…E-5, P-0…P-5, C-1…C-3, S-5). Un examen escrito desde el formulario
corrige el laboratorio: alumne01, 100/100. `make gui-paquete` (P-1…P-3) verde.
`make test` no se repitió; la actualización se prueba sin red. El almacén
cifrado, contra el `safeStorage` real de esta máquina: se guarda, el fichero
no contiene el valor, se recupera igual y «olvidar» lo borra.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, A-11).
- Un reintento exige el mismo PLAN. Intervalo mínimo del modo examen, 5 min.
- El proyector no tapa los nombres del alumnado: el profesor eligió la clase.
- La copia guarda las notas, no las pruebas: una corrección recuperada no
  enseña la salida de las máquinas, y lo dice en la propia pantalla.
- El paquete es Linux x64; Windows y macOS quedan fuera (2026-09-21).
- La actualización automática solo toca el AppImage; el `.deb` lo lleva apt.
  No hay ninguna release publicada contra la que probarla de verdad.
- El editor reescribe el YAML con su formato: mismo examen, otra disposición,
  y los comentarios del fichero no sobreviven a un guardado.

## Siguiente tarea recomendada

**T123** (el modo examen a la vista): recuperar la tarjeta que dice que se
guarda la mejor nota, de qué vuelta sale y el intervalo, con los alumnos
listados debajo. Ya no lleva contraseña: se la quedó T126.

Sin fecha: T059, T070, T080, T023.
