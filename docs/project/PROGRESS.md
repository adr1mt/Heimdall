# Estado del proyecto

**Actualizado**: 2026-10-29 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**T226 instalado y abierto desde el menú de Zorin:** T225 con motor embebido.
Rutas antiguas reparadas; respaldo privado y clase anterior conservada.
Demo local de 15 alumnos ficticios, cinco preguntas, 75 comprobaciones correctas.
Examen/clase seleccionados, sin SSH. [Evidencia](../reviews/evidence/T226/RESULTADOS.md).

**T225 terminado:** dependencias directas en sus últimas versiones
estables; React 19, TypeScript 7, Vite 8, Vitest 5, Zustand 5, Electron 45
y Go 1.27.3. npm sin vulnerabilidades/deprecated ni scripts pendientes.
Nuevo empaquetado Linux; 643 pruebas GUI, motor/SSH y editor real correctos.
[Evidencia](../reviews/evidence/T225/RESULTADOS.md).

**T221 instalado:** Pausar conserva una sesión abierta
recuperable; Reanudar mantiene su identidad, vueltas y mejores notas compatibles.
Cambiar criterios separa registros automáticamente. Finalizar espera la activa,
fija las notas válidas y abre una lista limpia de alumno/mejor nota, también
al reabrir. Histórico por sesiones; informes confirmados y reintentos con estado
por alumno, sin afectar notas por SSH. Exportación CSV/Moodle conservada.
[Evidencia](../reviews/evidence/T221/RESULTADOS.md).
[Decisión](../adr/0040-pausa-explicita-y-lista-final.md).

T197/T202: pública 1.0.1; los builds posteriores no son publicación.

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
- Electron 45.1.0 incorpora Node 24.22.1; herramientas Node 26.13.0/npm 12.2.1.
- Go: aviso OpenPGP del módulo SSH, sin importar ni incluir ese paquete.
- Dependencias internas respetan las versiones compatibles fijadas upstream.

## Siguiente trabajo

T070 READY: T204 reparó solo RA1.
T084 espera prueba de aula de Adrià. T023 y T186 siguen READY.
T223/T224/T225 instalados (T226); sin publicación nueva autorizada.
