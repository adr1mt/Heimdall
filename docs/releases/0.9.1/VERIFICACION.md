# Verificación de distribución 0.9.1

Fecha: 2026-10-03. Base inicial: b2a0a73, árbol limpio. La release incorpora
T156–T159 además de las reparaciones T127–T155. Arquitectura revisada y cerrada
(T160); código de release: `022f2e7`. No se cambia ninguna regla de notas, SSH, copias o formato.

## Paquetes

`make gui-dist` reconstruye motor y GUI como 0.9.1 y genera:

- `gui/dist/Heimdall-0.9.1.AppImage`
- `gui/dist/Heimdall-0.9.1.deb` (heimdall-gui, amd64, 0.9.1)

[SHA256SUMS](SHA256SUMS) identifica exactamente los paquetes comprobados.
Para probar la actualización se creó una copia del AppImage 0.9.0 anterior en
`/tmp/heimdall-release-0.9.1/Heimdall.AppImage`; su hash inicial se registra en
[evidence/baseline.sha256](evidence/baseline.sha256). No se sustituye ninguna
instalación o perfil del profesor.

## Comprobaciones terminadas

- `GOCACHE=/tmp/heimdall-release-go-cache make test`: suite rápida, integración
  SSH, versión, secretos, aceptación, eventos, sesiones, RA2 y 100 alumnos.
  [Registro](evidence/go-test.log).
- `make gui-check`: tipos y **525 tests, 33 archivos**.
  [Registro](evidence/gui-check.log).
- `make gui-dist`: build y preload CommonJS verificado.
  [Registro](evidence/build.log).
- `make gui-editor`: D-1…D-7 y regresiones A06/A09 del editor correctas.
  [Registro](evidence/editor.log).
- `make gui-lab`: S-0…S-4, H-1, X-1/2 y B-1…B-3 correctos; sin contraseña en
  argv, entorno, perfil, informes ni copias. [Registro](evidence/gui-lab.log).
- `make gui-paquete`: P-1…P-3 correctos; motor incluido, resultados iguales con
  entorno vacío, aplicación sin motor en PATH. [Registro](evidence/package.log).
- Modo examen: dos vueltas reales separadas por cinco minutos, un solo motor,
  nota y procedencia correctas, alumno perfecto excluido de la segunda vuelta,
  máquina apagada sin nota, proyector y cierre correctos.
  [Registro](evidence/exam-chain.log).
- AppImage final y contenido del .deb ejecutados con perfiles temporales:
  versión de GUI y motor 0.9.1, renderer con sandbox, corrección SSH, resultados,
  histórico, exportación CSV, eliminación de originales y recuperación,
  proyector y pantallas de analíticas/clases/editor/ajustes/ayuda. Cierre normal
  con código 0. [AppImage](evidence/appimage-e2e.log), [.deb](evidence/deb-e2e.log).
  Capturas: [AppImage](evidence/appimage-results.png), [.deb](evidence/deb-results.png).

Los estados y todas las cifras de las notas restauradas se comparan exactamente
con los originales. La pantalla recuperada añade el aviso de restauración y el
aviso de que las copias no guardan las salidas; no se exige igualdad de esos avisos.
El prototipo incluye deliberadamente un comando inexistente, un timeout y una
máquina apagada: ambos alumnos conservan la ausencia de nota final correspondiente.

El arnés inicial esperaba un CSV sin marca UTF-8 y comparaba todo el texto de la
pantalla antes/después de restaurar, incluidos esos avisos. Se corrigieron las
expectativas, sin cambiar la aplicación. Registros iniciales conservados.
La primera prueba de dos vueltas usó el examen de averías `testdata/proto`, que
no permite una nota final por su timeout deliberado: S-2 falló con cero alumnos
con nota; ese registro se conserva en `exam-chain-adverse.log`. La prueba de
sesión debe usar `testdata/sesion`, que completa el alumno disponible y lo deja
fuera de la segunda vuelta. Se ajustó el arnés existente para elegir la escala
0–100 desde Ajustes antes de comparar la nota canónica del motor; no se cambió
el cálculo ni la pantalla del producto. La ejecución sin esa elección se
interrumpió, y el primer ajuste se corrigió para regresar a Inicio antes de abrir
el examen; sus registros se conservan como ejecuciones incompletas.
También se corrigió la sincronización del inspector con el arranque del main y
la limpieza del grupo de procesos de pruebas; no son defectos del paquete.

## Reproducción

Con Node 24, Go, dependencias de `gui/`, pantalla Linux disponible y laboratorios
locales levantados mediante `make lab` y `make lab-ra2`:

```bash
GOCACHE=/tmp/heimdall-release-go-cache make test
make gui-check
GOCACHE=/tmp/heimdall-release-go-cache make gui-dist
make gui-editor
make gui-lab
make gui-paquete
bash docs/releases/0.9.1/evidence/exam-chain.sh
node docs/releases/0.9.1/evidence/package-e2e.mjs gui/dist/Heimdall-0.9.1.AppImage appimage
dpkg-deb -x gui/dist/Heimdall-0.9.1.deb /tmp/heimdall-deb-verificacion
node docs/releases/0.9.1/evidence/package-e2e.mjs /tmp/heimdall-deb-verificacion/opt/Heimdall/heimdall-gui deb
```

Ejecutar todos los arneses SSH secuencialmente. La comprobación directa de paquetes
usa el inspector solo en localhost y sustituye únicamente el diálogo de destino
del CSV en memoria; no modifica el paquete. Los perfiles y exámenes son ficticios
y están en /tmp. Arranque con `--no-sandbox` como los arneses existentes; el
renderer conserva su sandbox y aislamiento de contexto.

## Publicación y límites

GitHub confirma que `adr1mt/Heimdall` es **privado** y no tenía releases.
[Release privada publicada](https://github.com/adr1mt/Heimdall/releases/tag/v0.9.1),
como última versión, con tres assets y etiqueta sobre `022f2e7`.
[Metadatos de GitHub](evidence/github-release.json): tamaños y SHA-256 exactos
de AppImage, .deb y SHA256SUMS contrastados con los archivos locales. El AppImage
se ha descargado de GitHub con la sesión del propietario; su hash coincide.
El actualizador instalado consulta sin autenticación
`https://api.github.com/repos/adr1mt/Heimdall/releases/latest`.
Una publicación privada por sí sola no permite la actualización automática.
La elección de distribución está pendiente: repositorio público de paquetes,
cambiar la visibilidad del código o mantener descargas privadas/manuales.
No se cambia la privacidad del repositorio sin esa decisión del propietario.

El .deb se extrae y ejecuta desde su contenido real; **no se instala con dpkg**,
porque `sudo -n` requiere la contraseña del administrador. El examen real de
aula T084 continúa pendiente de T070 y de Adrià. No se prueba apagón físico ni
se certifican otros sistemas operativos.

## Actualización real: manual correcta, automática bloqueada

[Registro real](evidence/real-update.log) y [arnés](evidence/real-update.mjs).
Se ejecutó el AppImage 0.9.0 anterior, con la clase ficticia `update-fixture`
guardada mediante su IPC y un perfil temporal propio. Su temporizador real
consulta GitHub al minuto: HTTP 404 sin autenticación, incluso con la release
publicada. No se inyectaron feed, bytes, credenciales ni proveedores de red.
El SHA-256 inicial `c349ad17dee1f0e57336d0d6d84e1f550e789dcc5765c8281b3bd37ae736a90f`
se conserva mientras la ventana está abierta y después del cierre normal.
La actualización automática **no se ha instalado ni se da por superada** (T163).

A continuación, con la aplicación cerrada, se sustituyó solo esa copia temporal
por el AppImage descargado auténticamente desde GitHub con `gh`, cuyo hash
coincide con la release. La reapertura confirma **GUI 0.9.1 y motor embebido
0.9.1**, la clase previamente guardada y un nuevo cierre normal (T164).
Es una actualización manual real; no demuestra el canal automático.
El arnés devuelve 3 para expresar el bloqueo automático aunque la parte manual
termine correctamente. El primer intento devolvía la función de desuscripción
al inspector, que no puede clonarse; se corrigió el retorno del arnés a un booleano.

Para repetir con los archivos anteriores locales aún disponibles:

```bash
mkdir -p /tmp/heimdall-release-0.9.1/github-download
cp gui/dist/Heimdall-0.9.0.AppImage /tmp/heimdall-release-0.9.1/Heimdall.AppImage
gh release download v0.9.1 --repo adr1mt/Heimdall --pattern 'Heimdall-0.9.1.AppImage' --dir /tmp/heimdall-release-0.9.1/github-download --clobber
node docs/releases/0.9.1/evidence/real-update.mjs /tmp/heimdall-release-0.9.1/Heimdall.AppImage /tmp/heimdall-release-0.9.1/github-download/Heimdall-0.9.1.AppImage
```

La sesión de `gh` autentica la descarga manual; nunca llega al proceso del
actualizador. Los laboratorios creados para esta sesión se eliminan al finalizar.
