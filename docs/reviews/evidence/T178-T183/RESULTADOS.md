# T178–T183 · Interfaz simplificada

Fecha: 2026-10-16. Base: `134ec411fb9e65df3571444fe342863aee7e9637`.
Paquete solicitado por Adrià tras revisar 21 parejas Teuton GUI/Heimdall.
[Galería de 16 capturas](index.html) · [Verificación automatizada](verification.json).

## Resultado

- Editor exclusivamente YAML, Monaco local y carga diferida: colores, líneas,
  búsqueda, deshacer, pegado y Ctrl+S. Conserva el texto; valida con el motor.
- Corregir: examen y clase, contraseña, modo examen independiente y lista previa.
- Lista/matriz con notas y aprobados coloreados; detalle dedicado por alumno.
  Filtros/explicaciones plegados. Proyector sin controles administrativos.
- Analíticas: atención prioritaria, fallos frecuentes, distribución y grupos.
  El histograma usa explícitamente los puntos nativos 0–100; las notas de la
  tabla usan la escala elegida. No se porta ningún formato de Teuton.
- Clases: usuario común (inicial `usuario`), excepciones por alumno y puerto
  22 oculto. Ayuda con índice y vista previa de notas en Ajustes.

## Evidencia ejecutada

- `GOCACHE=/tmp/heimdall-go-cache make check`: vet y pruebas Go correctos.
- `npm --prefix gui run typecheck`: node, web y tests correctos.
- `npm --prefix gui test`: **536/536**, 34 ficheros. Ejecutado con procesos
  hijos disponibles: los cuatro timeouts del sandbox restringido desaparecen
  sin cambios en las pruebas de cierre/recuperación.
- `npm --prefix gui run build`: correcto; preload CommonJS aislado verificado.
  Monaco y worker empaquetados sin CDN bajo la CSP de producción.
- Detector mecánico Impeccable sobre las siete rutas: `[]`. Capturas
  inspeccionadas en oscuro, claro y proyector.
- Arnés Electron `gui/scripts/ui-refresh.ts`, accesible por `make gui-editor`:
  IPC, preload, renderer y motor reales; perfiles y examen en un temporal.
  SSH contra `127.1.2.3:2201`, contenedor de prueba de `test/Containerfile`.
  Cinco alumnos ficticios, cinco comprobaciones `echo` con valores distintos.
  Notas canónicas verificadas: **100, 80, 60, 40, 20**; escala predeterminada:
  **10,0 / 6,7 / 4,3 / 2,9 / 1,4**.
- Pegado, guardado exacto incluido comentario, aviso al navegar, cancelación
  de salida, YAML sintácticamente inválido y peso negativo sin sobrescritura,
  reapertura de fichero roto y reparación. Sustituye el antiguo arnés de
  formulario, manteniendo sus regresiones aplicables. El arnés no necesita
  leer ni modificar el portapapeles del escritorio.
- Quinta máquina inaccesible: `final_score: null`, `NOT_EVALUATED`, causa
  visible; fuera del histograma y la media, no un cero académico.
- Primera pasada automática completada y modo examen detenido.
- Usuario común aplicado y guardado en los cinco alumnos; puerto 2202
  conservado al ocultar su columna y visible al volver a editar.
- Proyector con incidencia técnica: sin acciones de exportar ni reintentar.
- Renderer: ningún error de consola.
- `make docs-check tools-check`: enlaces correctos y 5 pruebas de herramientas.
- `git diff --check`: correcto.

## Reproducción y límites

Con el laboratorio SSH disponible: `make build gui-build gui-editor`. El arnés
crea su perfil y proyecto y reemplaza únicamente sus capturas de evidencia.
`make lab` prepara el laboratorio habitual; no ejecutar a la vez otros
arneses que utilicen su puerto.

No modifica motor, notas, contrato, almacenamiento de clases ni secretos.
La dependencia visual añade un chunk diferido de unos 4,4 MB sin comprimir
y un worker de 482 kB. El resaltado es sintáctico: el diagnóstico semántico
continúa siendo el del motor al validar/guardar.
Aula GISAR, rendimiento de una clase grande y proyector físico no probados
en este paquete. T070/T084 conservan el trabajo real de aula. No hay release
ni publicación: implementación y evidencia locales.
