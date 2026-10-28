# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.
**Actualizado**: 2026-10-28 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**T220 preparado, pendiente de instalar:** mejores notas persistentes,
recuperación automática, cierre definitivo y tabla «Mejores notas» en Resultados.
La nota principal conserva la mejor vuelta; las comprobaciones muestran la
última. Cierre espera la activa, persiste estado y orígenes; otro criterio o
corrección tras finalizar abre otro registro. CSV/Moodle finales, informe de
la vuelta ganadora por alumno y envío confirmado con recibos/reintentos.
634 pruebas GUI, tipos/build/preload, motor, docs/herramientas y laboratorios
con datos ficticios correctos. [Evidencia](../reviews/evidence/T220/RESULTADOS.md).
[Decisión](../adr/0039-sesiones-persistentes-y-cierre-definitivo.md).

**Instalación actual: T219**, interfaz compacta, nombres y escala persistente.
Motor RA1 v2 T218 idéntico; copia anterior verificada y push confirmado.
[Instalación](../reviews/evidence/T219/RESULTADOS.md). Cerrar/abrir para cargarla.
T218: RA1 v2 separado, 12 criterios/peso 19, siete Kea de peso 2,
DNS DHCP 8.8.8.8 y forwarding guardado; [evidencia](../reviews/evidence/T218/RESULTADOS.md).
T215 instalado: informe normal `informe.html`, reemplazable.
T197/T202: pública 1.0.1 (`a5ccaf9`), [publicación](../releases/1.0.1/PUBLICACION.md).
Las compilaciones posteriores conservan ese número nominal; no son otra publicación.

## Problemas conocidos y límites

- T220 no infiere sesiones anteriores sin manifiesto. Fuentes completas del
  PLAN: un cambio textual también puede separar registros. Artefactos originales
  necesarios para reconstruir; no protege frente a pérdida del disco.
- Informes finales privados por sesión; Desktop los recupera por SFTP/SSH.
  La privacidad entre alumnos exige credenciales propias; contraseña común no aísla.
- RA1 no evalúa el cliente ni su registro. Kea valida archivo guardado;
  gateway/DNS son opciones declaradas, no configuración efectiva del cliente.
- Si el consumidor no lee, puede faltar progreso y `run.end`; el resultado
  guardado conserva la nota. T220 recupera el artefacto mediante la intención guardada.
- Copias de notas: 128 MB es heap V8 probado, no RSS ni cualquier examen.
- Fuentes: 50 versiones/origen, 4 MiB, privadas. Clases guardan contraseña.
- Laboratorio en 127.1.2.3; arneses SSH/secretos secuenciales. Sin sudo: 2298.
- Reintentos: mismo PLAN, 50 eslabones. Examen: mínimo 5 min.
- Hasta 2000 celdas, 1 MiB de metadatos e inventario de 65536 bytes.
- Cierre normal espera resultado/copia; cierre forzado puede interrumpirlo.
- Linux x64. AppImage/.deb. Editor conserva texto; Monaco diferido local.
- Informe normal exige fuentes vigentes; final usa fuentes conservadas verificadas.
- Un informe con la contraseña de la clase no se envía.
- Electron 43.8.3 incorpora Node 24.22.0; actualizador mitigado, runtime pendiente.
  npm: 8 moderados de build con excepción específica.

## Siguiente trabajo

Instalar T220 cuando se solicite. T070 READY: T204 reparó solo RA1. T084 espera
prueba de aula de Adrià. T023 y T186 siguen READY. Sin publicación autorizada
para los cambios nuevos.
