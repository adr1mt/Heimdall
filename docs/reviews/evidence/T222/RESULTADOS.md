# T222 · Sesiones persistentes y pausa reinstaladas

2026-10-29. Autorización explícita: «Commit, push y reinstala en mi maquina».
Código de producto: `a843b538005754f792e926bff8b7d7d287536f3d`, con T220/T221.

## Verificación

- Repositorio limpio al empezar. Fuente confirmada, sin cambios de producto
  durante el empaquetado. Motor reconstruido desde la misma revisión.
- `GOCACHE=/tmp/heimdall-go-cache make check`: vet y nueve paquetes correctos.
  Reutilizada la validación de T221 para la misma fuente: 642 pruebas GUI,
  tipos, interfaz Electron, recuperación real y laboratorio nativo.
- AppImage construido con main, preload y renderer; preload CommonJS sandboxed
  verificado. Los 26 archivos compilados coinciden con el contenido del paquete.
- Cuatro dependencias de producción verificadas: js-yaml, argparse,
  @monaco-editor/react y @monaco-editor/loader.
- Motor incluido idéntico al recién compilado. SHA-256
  `08771d2ab813cae78358979b2123211f7d52fecacaa9a802dd78ecda72a81cc9`.
  Conserva el RA1 v2 e incluye la entrega final de T220.
- AppRun correcto con/sin namespaces y con/sin fallback explícito.
- Arranque real del paquete extraído y del AppImage instalado, cada uno con
  perfil temporal vacío: `Package auto: renderer and preload OK (Heimdall)`.
- Paquete, instalación y copia anterior verificados por SHA-256.
  [Manifest](instalacion-local.json).

## Instalación

Destino: `/home/adr1/Aplicaciones/Heimdall/Heimdall.AppImage`.
Copia anterior recuperable:
`Heimdall.AppImage.antes-sesiones-pausa-2026-10-29.bak`, en la misma carpeta.
Copia y temporal sincronizados; comprobación de concurrencia antes de una
sustitución atómica. Instalado SHA-256:
`8d182a30f479441f47e96f5a8a568cb6f1b1396622d807dd3602010321533821`.

El primer intento se detuvo antes del reemplazo al sincronizar el directorio
con un descriptor de tipo incorrecto. Se corrigió la operación; copia y original
se verificaron de nuevo antes de completar la sustitución. No afectó a datos.

No había procesos principales Heimdall activos al terminar la instalación.
No se cerraron ni reiniciaron instancias habituales; no se tocaron perfiles,
clases, exámenes ni notas. La aplicación queda lista para abrir desde el acceso
habitual. Versión nominal 1.0.1 conservada; no es una publicación nueva.

## Git

Push normal a `origin/main` del producto, confirmado por `git ls-remote`:
`a843b538005754f792e926bff8b7d7d287536f3d`.
El registro de instalación se guarda y sube en un commit separado; su revisión
se comprueba contra el remoto al cerrar. Sin force-push, etiquetas ni releases.
Esta validación local no certifica CI ni una prueba de aula nueva.
