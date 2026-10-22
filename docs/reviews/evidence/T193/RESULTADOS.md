# T193 · Informe individual más claro y fácil de imprimir

Petición expresa de Adrià. Base: `bef8e7c`. Cambios revisados: generador del
informe individual, pruebas, arnés sintético y documentación de esta tarea.
No cambia el motor, la calificación, las escalas, los destinatarios ni la entrega.

## Resultado

- Nota principal semibold, escala secundaria, veredicto discreto y cabecera sin
  caja de color; nombres y títulos largos se dividen sin ocultarse.
- «Qué debes revisar» después del resumen y del aviso técnico: solo FAIL,
  descripciones literales escapadas, orden de bloques y máximo ocho filas.
  El recuento restante enlaza al desglose, que conserva todas las comprobaciones.
- Desglose con líneas suaves, aciertos neutros, fallos con fondo tenue y símbolos
  diferentes. Etiquetas académicas disponibles para lectores de pantalla y
  leyenda visible; «No se pudo comprobar» continúa visible en cada fila técnica.
- Barra proporcional al número de comprobaciones, sin confundirla con la nota;
  caso vacío explícito sin barra. Se conservan pesos y motivos técnicos generales.
- No existe un diagnóstico académico adicional autorizado: se mantienen solo
  descripción y estado. No se incorporan detalles, comandos, salidas o aserciones.
- Impresión A4, márgenes de 14 mm, bloques divisibles, títulos junto a su primera
  fila y explicaciones breves junto a la descripción. Textos de varias páginas
  continúan sin recorte y sin reservar una página completa antes de comenzar.

## Comprobaciones automáticas

- `make check`: correcto antes de editar.
- `make gui-check`: tipos y **556 pruebas** correctos (15 del informe/entrega).
  Primer intento aislado: 4 fallos por timeout en shutdown y backup-recovery.
  Repetición sin aislamiento: suite completa correcta, sin cambiar timeouts.
- `make gui-build`: correcto, también la verificación de preload.
- `make docs-check`, `make tools-check`, `git diff --check`: correctos.
- Regresiones: todos PASS, todos FAIL con límite ocho, mezcla con UNEVALUATED,
  totalmente sin evaluar, parcial, vacío, escala 10/100, decimales, umbral,
  pesos diferentes y comprobación técnica de peso cero con nota final válida.
- Escape de alumno, título, bloque y descripción; aislamiento entre alumnos,
  ausencia de contraseñas y datos internos, sin explicaciones inventadas.
- Arnés: seis ejemplos en cuatro anchos (aprox. 980/600/390/320 px; redondeo del
  gestor de ventanas), **24 comprobaciones**, sin desbordamientos, recortes,
  solapamientos de cabecera ni peticiones de red. [Mediciones](verification.json).
- PDF: tamaño A4 en seis ficheros, márgenes de texto comprobados por coordenadas
  en los PDF con texto; las 75 comprobaciones del largo están presentes. En el
  extremo se conservan los dos inicios/finales y las 560 frases esperadas entre
  resumen y desglose. [Mediciones PDF](pdf-verification.json).

## Verificación visual

Revisados el informe corto, mixto, correcto, vacío y largo en pantalla ancha y
estrecha. Revisados los PDF de una y ocho páginas, renderizados con Poppler;
inspección de todas las páginas de largo y extremo, incluidos saltos de bloque,
filas técnicas, nombres sin espacios y una descripción mayor que una página.
También revisadas las ocho páginas en gris sin fondos: los estados siguen
siendo reconocibles por sus símbolos y la leyenda. No se redujo el informe a
una sola página. La primera pasada detectó un hueco antes del texto extremo;
la segunda confirma su corrección y el contenido completo.

## Ejemplos y reproducción

Todos los nombres y resultados son ficticios. Abrir directamente en el navegador:

- [Corto con nota](corto.html), [mixto sin nota final](mixto.html),
  [todo correcto](correcto.html), [vacío](vacio.html).
- [Largo de 75 comprobaciones](largo.html), [texto extremo](extremo.html).
- [PDF corto](corto.pdf), [mixto](mixto.pdf), [largo de ocho páginas](largo.pdf),
  [extremo de ocho páginas](extremo.pdf).
- [Corto en gris sin fondos](corto-sin-fondos-gris.pdf) y
  [largo en gris sin fondos](largo-sin-fondos-gris.pdf).
- [Páginas del largo](paginas-largo.png) y [del extremo](paginas-extremo.png).
  Las demás capturas muestran la pantalla, no páginas impresas.

Desde `gui/`, con el entorno gráfico disponible:

```bash
node_modules/.bin/esbuild scripts/report-preview.ts --bundle --platform=node --format=esm --external:electron --outfile=/tmp/heimdall-report-preview.mjs
node_modules/electron/dist/electron /tmp/heimdall-report-preview.mjs --no-sandbox
```

## Límites

Verificación realizada con Chromium de Electron en Linux. No se ha probado
impresión física ni otros navegadores. Los PDF en gris son evidencia visual:
el filtro de simulación los rasteriza y por ello no se validan por extracción
de texto; los PDF normales conservan texto. Ningún informe se ha enviado a
máquinas de alumnos. No hay nueva función de exportación PDF en la aplicación;
se utiliza la impresión del navegador.
