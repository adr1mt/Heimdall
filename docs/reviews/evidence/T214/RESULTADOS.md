# T214 · Instalación de las mejoras de aula e informes

Instalación local autorizada expresamente por Adrià el 2026-10-27.
Fuente: `016d704` (T211–T213). Resultado: **CORRECTO**.

## Verificación

- `GOCACHE=/tmp/heimdall-go-cache make check build`: correcto.
- `npm run build`, verificación de preload y AppImage con
  `electron-builder --linux AppImage --publish never`: correctos.
- **26 ficheros** GUI coinciden byte a byte con los contenidos del paquete.
  Comprobados Ajustar a pantalla, Reducir zoom, Enviar informe y Última
  completada en el módulo de Resultados.
- Motor incorporado idéntico a `bin/heimdall`, con entrega selectiva T213 y
  reparación Kea T209 conservada. Versión nominal `heimdall 1.0.1`.
- AppRun conserva argumentos y fallback correctos en las cuatro variantes
  del comprobador. [Arranque real con perfil temporal vacío](arranque.txt):
  renderer y preload correctos; solo se detuvo esa instancia de prueba.
- La primera construcción dentro del aislamiento no pudo descargar Electron
  por bloqueo de red. La construcción fuera del aislamiento terminó bien.

## Instalación

[Manifest y SHA-256 de paquete, motor, instalación y versión anterior](instalacion-local.json).

Instalado en `/home/adr1/Aplicaciones/Heimdall/Heimdall.AppImage`, manteniendo
el destino del lanzador existente. Copia recuperable:
`Heimdall.AppImage.antes-zoom-informes-2026-10-27.bak`, en la misma carpeta.

Se verificó la huella anterior antes de copiar y de nuevo antes de sustituir.
Copia anterior y archivo temporal sincronizados a disco; sustitución atómica
con permisos de ejecución y comprobación de ambas huellas al terminar.
La instalación final coincide exactamente con el AppImage comprobado.

No se cierra ni reinicia la aplicación activa: cerrar y volver a abrir cuando
termine cualquier corrección para cargar las mejoras. No se modifican perfiles,
clases, exámenes, notas, credenciales ni máquinas del alumnado. Sin publicación,
cambio de número, etiquetas ni remotos. Esto no certifica aula ni CI remota.
