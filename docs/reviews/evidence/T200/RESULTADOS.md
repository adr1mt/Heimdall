# T200 · Versiones recuperables de clases y exámenes

2026-10-22. ADR-0034. Solo datos ficticios en pruebas y capturas.

## Comportamiento comprobado

- Cada guardado conserva versión anterior y propuesta, también el primer
  guardado. Bytes originales, UTF-8 y contenido corrupto preservados; SHA-256
  comprobado antes de recuperar o rotar. Sin cambios en copias de notas.
- Carpetas 0700, versiones y fichero publicado 0600. Hasta 50 versiones por
  origen, 4 MiB por fuente; fuente demasiado grande no se reemplaza. El fichero
  actual y la propuesta quedan protegidos durante la rotación.
- JSON de copia alterado, tipo incorrecto, ruta fuera del almacén y enlaces
  rechazados. Copia fallida o propuesta demasiado grande: original intacto.
- Fallo simulado justo al publicar el fichero: original intacto, ambas versiones
  recuperables y staging retirado. No se simula todo el sistema de archivos.
- Recuperación explícita de clases permite reparar un JSON dañado, conserva
  exactamente el original y valida la lista restaurada antes de escribirla.
  El guardado ordinario sigue bloqueado ante clases corruptas.

## Aplicación real

Arnés Electron `gui/scripts/source-backup-lab.ts`, con renderer, preload, IPC y
archivos reales; solo selector nativo y confirmación sustituidos por fixtures:

1. Cancelar recuperación mantiene la lista actual byte por byte.
2. Confirmar recupera la lista elegida y actualiza la pantalla.
3. Tras introducir JSON corrupto y recargar, el botón sigue disponible; recupera
   la lista y conserva el original dañado en las versiones.
4. El examen recuperado queda en borrador y el YAML en disco no se modifica.
5. Otro borrador sin guardar bloquea el botón y no abre otro selector.

Capturas inspeccionadas: Clases a 1280 px en claro y editor a 960 px en oscuro.
Controles legibles, sin solapamiento; el editor conserva el aviso de borrador.
La barra de éxito roja es el problema preexistente T187, fuera de este cambio.

Tipos y suite GUI correctos (571 pruebas), build/preload, make check, docs-check
y nueve pruebas de herramientas. El arnés se añade al workflow de publicación,
que aún no se ha ejecutado en GitHub.

Límites: perfiles y diálogos reales de otros escritorios, corte eléctrico y
lectores de pantalla no probados. Las copias permanecen en el mismo disco y no
sustituyen una copia externa. La selección permite navegar al directorio de
copias de una ubicación anterior; no asigna identidad persistente al proyecto.
