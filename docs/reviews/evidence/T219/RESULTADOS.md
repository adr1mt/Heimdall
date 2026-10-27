# T219 · Interfaz compacta reinstalada

2026-10-27. Autorización explícita: «reinstala, commit y push».
GUI desde `1364223`, con T216/T217. Motor instalado por T218 conservado
exactamente, SHA-256 `607db070ec191848e4b6db7df3290c15a694e525f6de2d070e604db8435c1c08`.

## Verificación

- Construcción en un árbol temporal del código confirmado, con dependencias
  copiadas, sin incorporar cambios en curso del motor o del examen.
- 620 pruebas GUI, tipos Node/web/tests, build y preload correctos.
- `make check` correcto al empezar. El motor conservado tiene también
  [su validación independiente](../T218/RESULTADOS.md).
- 26 archivos GUI idénticos entre compilación y paquete final; presentes
  nombres abreviados, controles compactos y sus dependencias de producción.
- AppRun correcto en las cuatro variantes del comprobador y
  [arranque real con perfil temporal vacío](arranque.txt): renderer y preload OK.
- Instalación, copia anterior y paquete comprobados por huellas.
  [Manifest](instalacion-local.json).

El primer empaquetado con node_modules enlazado omitía dos dependencias
transitivas. Se descartó y se repitió con una copia completa; paquete final
comprobado con ambas dependencias presentes. La consulta inicial del motor
con `--version` fue rechazada; `version` devolvió `heimdall 1.0.1` correctamente.

## Instalación

Destino: `/home/adr1/Aplicaciones/Heimdall/Heimdall.AppImage`.
Copia anterior recuperable en la misma carpeta:
`Heimdall.AppImage.antes-compacto-nombres-2026-10-27.bak`.

Copia y archivo temporal sincronizados; huella anterior comprobada antes de
sustituir y cambio atómico. El paquete instalado conserva el motor RA1 v2.
No se cierra ni reinicia la instancia activa ni se tocan sus datos.
Cerrar y abrir cuando termine cualquier corrección para cargar las mejoras.

## Git

Commit de instalación y push normal a `origin/main` en curso. Se registrará
su confirmación tras comprobar el remoto. No hay publicación, etiqueta ni
cambio de versión nominal. Esta comprobación local no certifica aula ni CI.
