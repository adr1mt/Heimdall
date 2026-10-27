# T207 · Reservas KEA agrupadas con peso 2

27 de octubre de 2026. Base/head anterior: commit T206 `82d3592`, SHA completo
en TASKS.json. Incluye cambios locales en el programa fijo, su lista cerrada de
criterios, pruebas, examen mantenido, arnés y documentación.

## Resultado

Las cuatro comprobaciones individuales se sustituyen por **Reserves KEA**, ID
`kea-reserves`, peso **2**. Requiere las cuatro parejas MAC/IP correctas en su
ámbito aplicable. Una ausente, cruzada o incorrecta hace fallar todo el criterio,
sin puntos parciales. La configuración se lee y valida una sola vez; se reutiliza
la semántica de reservas ya existente. Los criterios individuales históricos se
conservan para sus regresiones y no aparecen en el examen actual.

Quedan **19 comprobaciones y peso total 24** (22 - 4 + 1; 26 - 4 + 2). Los otros
18 criterios conservan exactamente ID, descripción, argumentos, orden y peso;
solo cambia la revisión SHA-256 del programa necesaria para este nuevo criterio.

## Verificación

- `make check ra1-check build`: correcto. **26 pruebas Python**.
- Nuevas pruebas: cuatro reservas correctas; cada una de las cuatro ausente y
  cada una incorrecta; propiedades/formato compacto o multilínea; orden de
  reservas inverso; ámbito global habilitado/deshabilitado; parejas cruzadas;
  reserva conflictiva duplicada; falta de permiso conserva salida técnica 70.
- PLAN Go resuelve el criterio agregado, mantiene el rechazo de revisiones o
  criterios desconocidos y las protecciones de referencias secretas.
- `go test -race ./internal/plan ./internal/engine`: correcto.
- Comparación estructural de los 18 criterios restantes; [PLAN ficticio](plan.txt)
  aceptado con 19 criterios/peso 24, sin SSH ni alumnado real.
- `make gui-dist`: AppImage y .deb locales construidos, sin publicación.
- Motor extraído del AppImage idéntico al compilado y validación del examen
  correcta: [revisión y huella del paquete](paquete.json).
- [Editor Electron real](editor.txt): renderer, preload sandboxed, IPC y motor
  empaquetado validan y guardan exactamente los perfiles nuevos, sin clase.
- `make docs-check tools-check` y `git diff --check`: correctos.

La agrupación no cambia el parser ni las lecturas remotas ya validadas en T204;
no se repite su laboratorio DHCP. La verificación nueva de la agregación es la
suite de casos positivos, negativos y técnicos, y la integración nativa de PLAN,
paquete y editor. No se afirma una nueva evaluación de aula ni 19/19 por SSH.

## Instalación y recuperación

[Manifest local](instalacion-local.json): examen cargado idéntico al mantenido,
AppImage nuevo verificado, AppImage anterior conservado como
`Heimdall.AppImage.antes-reserves-2026-10-27.bak`. El mecanismo nativo conserva y
verifica versiones anterior y nueva del examen. Hay que cerrar/abrir Heimdall
para usar el motor nuevo; una mezcla de revisiones se rechaza antes de conectar.

Revisión del programa fijo:
`7a3b55fdd7e9a43a25d22948f5cf52da4202bacd07420816a2e25de6e46d8dd9`.
No se modifican clases, credenciales, notas, enunciado ni máquinas reales.
Se mantiene la arquitectura declarativa de ADR-0036: un nuevo criterio en el
conjunto cerrado, sin código del profesor en YAML ni cambios de modelo de nota.
