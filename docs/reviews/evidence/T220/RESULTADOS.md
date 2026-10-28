# T220 · Mejores notas persistentes y cierre definitivo

Fecha: 2026-10-28. Base: `e8afe1fc3550ea9d0087001d6bca1de615887080`.
Revisión de los cambios locales de T220 sobre esa base, incluidos los archivos
nuevos identificados en [source-hashes.json](source-hashes.json).

## Comportamiento entregado

Cada corrección se incorpora automáticamente a un registro privado de examen,
clase y criterios. La reconstrucción utiliza los artefactos originales y el
motor de sesiones: no se guarda otra colección de notas. La nota principal,
el resumen, los filtros por nota, la Lista, la matriz y el detalle muestran
la mejor vuelta completa; las comprobaciones conservan la última vuelta.
**Mejores notas** permite consultar toda la clase, vuelta de origen, sesiones
anteriores y exportar CSV/Moodle.

**Finalizar examen** persiste la intención, bloquea nuevas vueltas y espera
la activa sin cancelarla. Guarda cierre y orígenes de notas; recuperar completa
un cierre interrumpido. La siguiente corrección crea una sesión nueva. Una
modificación de fuentes o umbral separa criterios y conserva los anteriores.
Un alumno sin vuelta completa carece de nota final, no recibe un cero.

El envío requiere una sola confirmación; **Ahora no** conserva un acceso para
más tarde. Cada HTML usa el artefacto ganador de su alumno, con indicación de
informe final. Se reutilizan el transporte y las garantías de `deliver`, con
fuentes conservadas verificadas contra el PLAN original. El fichero final por
sesión es privado (`0600`), no sobrescribe otro contenido y admite reintentos
idénticos. Los recibos persistentes excluyen éxitos del siguiente intento.
El resumen distingue fallidos reintentables y alumnos sin nota final.

## Validación

- `make check`: `go vet` y todas las pruebas rápidas del motor correctas.
  Se usó `GOCACHE=/tmp/heimdall-go-cache` porque la caché habitual es de lectura.
- GUI: **634 pruebas**, tipos de Node/web/tests, build y preload correctos.
  El aislamiento bloqueó cuatro subprocesos Node de pruebas anteriores;
  un caso mínimo reprodujo el bloqueo y fuera del aislamiento pasó. La suite
  íntegra se ejecutó con los permisos necesarios, sin debilitar pruebas.
- Casos de persistencia, recuperación de artefacto sin `run.end`, criterios,
  umbral, huellas alteradas/ausentes, cierre en curso, doble pulsación,
  cierre interrumpido, exportación sin notas, página por destinatario,
  recibos tras reinicio y reintento parcial: correctos.
- Laboratorio con **motor nativo real y disco**, sin SSH: mejor vuelta anterior
  a la última para un alumno, mejor en la segunda para otro y ninguna completa
  para el tercero. Comprueba CSV/Moodle, reconstrucción tras perder el estado
  en memoria, referencias de vuelta y bytes históricos sin cambios. Incluye
  el caso 10 seguido de 7 en la escala vigente del profesor.
- Aplicación compilada con main/preload/renderer reales, perfil temporal:
  reabre automáticamente el examen reciente y su clase, recupera el estado
  finalizado y el 10, conserva fecha de cierre y no muestra cuenta atrás.
- Programa remoto fijo ejecutado en una carpeta personal ficticia: creación
  `0600`, reintento idéntico, rechazo de otro contenido, enlace y directorio,
  sin temporales sobrantes. La prueba descubrió y reparó el comportamiento de
  `ln` al recibir un directorio: se utiliza su opción sin directorio destino.
- `make docs-check tools-check build` y `git diff --check`: correctos.

## Interfaz y revisión independiente

Capturas con datos ficticios: [matriz clara 1366](desktop.png),
[oscura 1024](user-1024.png), [mejores notas](best-grades.png),
[confirmación final](final-prompt.png), [finalizado](finalized.png),
[lista](list-finalized.png), [detalle](student-detail.png) y
[entregas](delivery-summary.png). [Comprobaciones de interacción](session-ui.json).

El revisor independiente pidió corregir la nota dominante del detalle, la
clasificación de Lista y el recuento de alumnos sin nota como pendientes.
Las tres correcciones se aplicaron y se recapturaron; su revisión posterior
las calificó **resueltas**, disposición `ship` limitada a esos hallazgos.
La revisión de documentación visual confirmó la conservación de componentes,
tokens, densidad, tipografía y temas: no se añadió un sistema visual nuevo.
El lanzador/detector de la skill no estaba disponible como ejecutable; se
consultaron directamente el contexto, las reglas y los componentes existentes.

## Límites y decisiones

[ADR-0039](../../../adr/0039-sesiones-persistentes-y-cierre-definitivo.md).
Las huellas canónicas incluyen bytes completos: también un cambio textual
puede separar registros. El umbral académico pertenece a la sesión; cambiar
la escala de presentación no sustituye los criterios guardados.

No se deducen sesiones históricas anteriores a estos manifiestos. Permanecen
sus correcciones e informes originales. La recuperación presupone conservar
el disco con los artefactos; no se ha reiniciado físicamente el ordenador.

No se ha encontrado acceso directo configurado a Ubuntu Desktop: se mantiene
Archivos/SFTP por la conexión SSH del alumno, sin infraestructura adicional.
La privacidad entre alumnos requiere credenciales propias, como ADR-0037.
No se conectó al alumnado real ni se enviaron informes reales.

Compilado y guardado en el repositorio; pendiente de instalar en la aplicación
que usa el profesor. Sin publicación ni cambio de versión nominal.

## Reproducir los laboratorios

Desde `gui/`, después de construir el motor y la GUI:

```bash
node_modules/.bin/esbuild scripts/exam-session-lab.ts --bundle --platform=node --format=esm --outfile=/tmp/heimdall-native-session.mjs
node /tmp/heimdall-native-session.mjs
node_modules/.bin/esbuild scripts/exam-session-app.ts --bundle --platform=node --format=esm --external:electron --outfile=/tmp/heimdall-session-app.mjs
node_modules/electron/dist/electron /tmp/heimdall-session-app.mjs --no-sandbox
node_modules/.bin/esbuild scripts/exam-session-fixture.tsx --tsconfig=tsconfig.web.json --bundle --platform=browser --format=iife --outfile=/tmp/heimdall-session-fixture.js
node_modules/.bin/esbuild scripts/exam-session-ui.ts --bundle --platform=node --format=esm --external:electron --outfile=/tmp/heimdall-session-ui.mjs
node_modules/electron/dist/electron /tmp/heimdall-session-ui.mjs --no-sandbox
```

Estos arneses usan datos sintéticos, carpetas temporales y envío simulado;
ninguno inicia una corrección SSH real.
