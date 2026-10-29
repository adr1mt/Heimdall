# Estado del proyecto

**Actualizado**: 2026-10-29 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**T222 instalado: T220/T221**, con commit y push autorizados.
Paquete y arranque real verificados; copia anterior recuperable.
[Instalación](../reviews/evidence/T222/RESULTADOS.md).

**T221 instalado:** Pausar conserva una sesión abierta
recuperable; Reanudar mantiene su identidad, vueltas y mejores notas compatibles.
Cambiar criterios separa registros automáticamente. Finalizar espera la activa,
fija las notas válidas y abre una lista limpia de alumno/mejor nota, también
al reabrir. Histórico por sesiones; informes confirmados y reintentos con estado
por alumno, sin afectar notas por SSH. Exportación CSV/Moodle conservada.
642 pruebas GUI, tipos/build/preload, motor, docs/herramientas correctos;
Electron a 1080p/768p, laboratorio nativo y reapertura real con perfil ficticio.
[Evidencia](../reviews/evidence/T221/RESULTADOS.md).
[Decisión](../adr/0040-pausa-explicita-y-lista-final.md).

**T220 instalado**, incluido en T221: mejores notas persistentes,
fuentes conservadas, cierre definitivo y recibos/reintentos privados.
[Evidencia](../reviews/evidence/T220/RESULTADOS.md).
**Instalación anterior T219:** interfaz compacta, nombres y escala persistente.
Motor RA1 v2 T218 idéntico; copia anterior y push verificados.
[Instalación](../reviews/evidence/T219/RESULTADOS.md).
T218: RA1 v2 separado, 12 criterios/peso 19, siete Kea de peso 2,
DNS DHCP 8.8.8.8 y forwarding guardado; [evidencia](../reviews/evidence/T218/RESULTADOS.md).
T197/T202: pública 1.0.1, [publicación](../releases/1.0.1/PUBLICACION.md).
Las compilaciones posteriores conservan el número nominal; no son publicación.

## Problemas conocidos y límites

- No se infieren sesiones anteriores sin manifiesto. Compatibilidad conservadora:
  un cambio textual también puede separar registros. Artefactos originales
  necesarios para reconstruir; no protege frente a pérdida del disco.
- Informes finales privados por sesión; Desktop los recupera por SFTP/SSH.
  La privacidad entre alumnos exige credenciales propias; contraseña común no aísla.
- RA1 no evalúa el cliente ni su registro. Kea valida archivo guardado;
  gateway/DNS son opciones declaradas, no configuración efectiva del cliente.
- Si faltan eventos, el resultado se recupera mediante la intención guardada.
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
- npm: 8 moderados de build con excepción específica.

## Siguiente trabajo

T070 READY: T204 reparó solo RA1.
T084 espera prueba de aula de Adrià. T023 y T186 siguen READY.
El rediseño completo del proyector del adjunto anterior no forma parte de T221.
Sin publicación autorizada para los cambios nuevos.
