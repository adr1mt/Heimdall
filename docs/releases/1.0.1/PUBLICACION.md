# Publicación de Heimdall 1.0.1 · T202

Publicada el **2026-10-22 a las 18:46:04 UTC** (20:46:04 Europe/Madrid),
por autorización explícita de Adrià, con la prueba de clase reservada para él.

- [Publicación estable v1.0.1](https://github.com/adr1mt/Heimdall/releases/tag/v1.0.1).
- Etiqueta y código validado: `a5ccaf9ddedf2bf2a5e6b8f495b76cf0c70d464b`.
- [Checks: correcto](https://github.com/adr1mt/Heimdall/actions/runs/39832488570).
- [Release validation: correcto](https://github.com/adr1mt/Heimdall/actions/runs/39832515560).

Ambos recorridos terminaron correctamente para ese mismo commit antes de
publicar. La documentación posterior de cierre puede avanzar `main` sin
cambiar la etiqueta ni los paquetes.

## Resultados y límites

574 pruebas GUI, tipos y construcción; diez pruebas de herramientas; enlaces
locales, versiones, Go con detector de carreras, integración SSH y aceptación
completa, sudo incorrecto/sin sudo, cancelación, eventos, sesión, tubería llena,
RA2 y carga de 100 alumnos ficticios: correctos. govulncheck: cero
vulnerabilidades alcanzables y cero en paquetes importados; queda un aviso de
módulo no importado. npm conserva los ocho avisos moderados de construcción
bajo la excepción específica documentada; no se declara ausencia total de avisos.

También pasan en GitHub el transporte Chromium con Brotli real, la recuperación
de fuentes por la interfaz, el motor empaquetado, el arranque con renderer y
preload en modo automático/fallback, y la instalación, comprobación y retirada
del .deb en contenedores Ubuntu 24.04 y 26.04. El runner de GitHub no permite
user namespaces: su comprobación de **sandbox real queda omitida**. Ese modo
sí pasó en la [verificación local de los paquetes](VERIFICACION.md); el fallback
reduce el aislamiento y no lo sustituye.

La corrección completa con una clase real **no se ha ejecutado**. T070/T084
siguen pendientes de Adrià. Electron 43.8.3 mantiene Node 24.22.0 sin el parche
pendiente; la mitigación del actualizador no equivale a parchear el runtime.
Los restantes límites están en las [notas de publicación](NOTAS.md).

## Integridad pública y actualizador

Se consultó sin autenticar el feed público `releases/latest` después de publicar:
versión estable, no borrador, etiqueta v1.0.1. El parser del actualizador de la
aplicación reconoce 1.0.1 como superior a 1.0.0 y obtiene la URL pública del
AppImage. La etiqueta descargada con Git apunta al commit validado.

Los tres assets figuran subidos; sus tamaños y digests SHA-256 de GitHub
coinciden con los archivos locales verificados. Se descargó además el
SHA256SUMS público y se comparó byte por byte con el original. No se descargaron
de nuevo los dos paquetes completos: su integridad remota se comprobó mediante
los digests de GitHub.

| Archivo | Bytes | SHA-256 |
|---|---:|---|
| Heimdall-1.0.1.AppImage | 144861633 | `b90d7ad77aa0429e4b75bc2b5cda1c4a069137ede1e698c29ca563ea48747d3b` |
| Heimdall-1.0.1.deb | 122258012 | `af06284d44b47006451b2d325ee9be39928baebf2300c4289624c962a44aa650` |
| SHA256SUMS | 175 | `37146ab2f716ce31364563a4fbe909926c6d1b8b8be9674b69589827bc8f2706` |

## Reparaciones necesarias en la validación remota

1. [Primer recorrido](https://github.com/adr1mt/Heimdall/actions/runs/39827851971):
   electron-builder intentaba publicar implícitamente desde CI. `make gui-dist`
   ahora exige `--publish never`, igual que la construcción local comprobada.
2. [Segundo recorrido](https://github.com/adr1mt/Heimdall/actions/runs/39828867559):
   Electron 43 no descarga el ejecutable de desarrollo con `npm ci`. El workflow
   ejecuta explícitamente su instalador oficial antes de los arneses.
3. [Tercer recorrido](https://github.com/adr1mt/Heimdall/actions/runs/39830665212):
   el comprobador del paquete consultaba el DOM antes de existir `document.body`.
   Se reprodujo el fallo con una prueba y se corrigió la sonda, conservando
   las exigencias de interfaz/preload y el plazo original. Los arneses se
   adelantan para detectar estos fallos antes del recorrido SSH.

Estos ajustes afectan a CI y sus comprobadores. Los archivos de aplicación y
motor no han cambiado desde la preparación `b02f250`; los paquetes publicados
son exactamente los de la verificación local, con las mismas sumas.
