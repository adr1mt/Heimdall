# T221 · Pausar, reanudar y finalizar con una lista limpia

2026-10-29. Base: `2633a83` (T220). Revisado el cambio local de T221,
registrado en TASKS y [ADR-0040](../../../adr/0040-pausa-explicita-y-lista-final.md).
No se modificó el motor Go ni se tocaron clases, exámenes o notas reales.

## Criterios y resultado

- **Pausa durable:** detiene programación y limpia credenciales en memoria;
  la vuelta activa puede acabar o usar el botón Detener existente. No fija
  notas ni genera envíos. Estado PAUSED recuperable después de reiniciar.
- **Reanudación:** mantiene identidad y vueltas compatibles, incluidas sesiones
  pausadas elegidas del histórico. El renderer ya no vacía la lista al iniciar.
  Cambios en criterios, inventario o umbral separan registros automáticamente.
- **Cierre:** solo Finalizar examen fija los orígenes finales. Bloquea nuevas
  vueltas, espera la activa y conserva notas válidas aunque se haya editado
  el examen sin volver a corregir. Doble clic: un único cierre.
- **Lista final:** se abre automáticamente al cerrar y recuperar una finalizada.
  Alumno y mejor nota; sin vueltas, procedencia, filtros, contadores ni resumen.
  El umbral guardado de la sesión fija también su conversión de escala.
- **Histórico:** sesiones del examen/clase como entradas principales, con
  estados diferenciados y apertura directa de la lista final. Correcciones
  consultables bajo un desplegable; notas, artefactos y finales anteriores
  no se reescriben. Los resultados sin manifiesto siguen siendo consultables.
- **Entrega:** acción explícita con confirmación, también antes de reintentar.
  Cada informe usa la evidencia de su propia mejor vuelta. La lista muestra
  entregado/no entregado y el fallo individual, sin cambiar la nota. Recibos
  persistentes y éxitos excluidos de reintentos. CSV y Moodle disponibles.

## Pruebas ejecutadas

- `GOCACHE=/tmp/heimdall-go-cache make check`: correcto (vet y nueve paquetes).
- `npm test -- --maxWorkers=2 --reporter=dot`: **642 pruebas, 47 archivos**, correctos.
- `npm run typecheck`: Node, web y pruebas correctos.
- `npm run build`: main, preload y renderer correctos; preload sandboxed validado.
- `make docs-check tools-check`: enlaces y diez pruebas de herramientas correctos.
- `git diff --check`: correcto.
- `exam-record.test.ts`: pausa con vuelta pendiente, reinicio, mismo ID al
  reanudar, separación de criterios, selección de una pausada anterior y
  manifiesto finalizado inalterado. Conserva pruebas previas de recibos y
  reintentos parciales con reinicio y privacidad por destinatario.
- `exam-finalization.test.ts`: cierre con vuelta activa, con edición de criterios
  y desde una pausa; la pausa conserva el motor y no crea cierre ni envíos.
- `exam-actions.test.ts`: reanudación sin borrar vueltas, registro incompatible,
  bloqueo durante una vuelta activa y pausa de seguridad si falla la lectura.
- Laboratorio nativo real: 10 tras una corrección peor y otra con CONNECT_FAILED;
  otro alumno conserva su mejor nota de la segunda corrección y quien nunca
  respondió queda sin nota. Pausa/reinicio/reanudación del mismo ID, CSV/Moodle,
  informes con evidencia de origen y bytes históricos intactos.
- Electron con main/preload/renderer construidos: recupera un ACTIVE interrumpido
  como PAUSED, reabre la pausa, finaliza y vuelve a abrir en la lista final.
  Nota 100 conservada después del fallo SSH, sin errores de consola.
- Electron de interfaz con 14 alumnos × 19 comprobaciones: pausa/reanudación
  sin diálogos, cambio matriz → lista, confirmación antes de enviar y reintentar,
  error de entrega con nota conservada, CSV, histórico y reapertura final.
  Cambiar el umbral actual no modifica la nota final (90 sigue mostrando 8,3
  con el umbral 70 de la sesión). [Resultado automático](session-ui.json).

La ejecución restringida impidió procesos hijos de Node en pruebas antiguas
(EPERM/timeout); la suite completa fuera de esa restricción pasó. Caché Go en
/tmp porque la habitual es de solo lectura. No se modificaron esos tests.

## Capturas de Electron

Capturas de estados con datos ficticios, no comparación con un checkout antiguo.
La lista de 14 alumnos cabe completa en 1366 × 768; 1920 × 1080 conserva el ancho
legible. El estado de entrega añade una columna solo después de intentarla.

- [Matriz durante la sesión](matrix-active-1366.png).
- [Matriz pausada](matrix-paused-1366.png).
- [Lista final · 1366 × 768, tema claro](final-grades-1366.png).
- [Lista final · 1920 × 1080, tema oscuro](final-grades-1920.png).
- [Informe no entregado con nota conservada](report-not-delivered-1366.png).
- [Histórico por sesiones](session-history-1366.png).

## Límites y entrega

Sin instalación, publicación, push ni envíos reales. Instalación vigente: T219.
La separación de compatibilidad de ADR-0039 sigue siendo conservadora: cambios
textuales también pueden separar registros. No se infieren sesiones anteriores
sin manifiesto. Las evidencias originales deben permanecer disponibles.
SSH se simula como fallo en artefactos canónicos y recibos: no se ejecutaron
conexiones al alumnado ni un laboratorio SSH nuevo. Las pruebas existentes de
cancelación y cierre de procesos permanecen en la suite.

El rediseño completo del proyector descrito en el adjunto anterior queda fuera
de T221: esta tarea atiende la petición más reciente de ciclo de examen y lista
final. No añade dependencias ni cambia los criterios de evaluación.
