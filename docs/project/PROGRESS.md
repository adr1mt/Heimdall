# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.
**Actualizado**: 2026-10-27 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**T210:** interfaz T208 instalada con motor T209 conservado, copia anterior y
huellas verificadas. Cerrar/abrir al terminar de corregir; no se reinició.
[Instalación](../reviews/evidence/T210/RESULTADOS.md).

**T208:** ocultos, Evaluados y orden en proyector; 601 pruebas GUI y arnés correctos. [Evidencia](../reviews/evidence/T208/RESULTADOS.md).

**T209:** Kea con identidad del servicio; acceso imposible técnico, errores
reales conservados. 30 pruebas Python, Go y paquete correctos. AppImage/examen
instalados con originales; requiere nueva corrección. [Evidencia](../reviews/evidence/T209/RESULTADOS.md).

**T207:** RA1: 19 criterios/peso 24; cuatro reservas juntas, peso 2. [Evidencia](../reviews/evidence/T207/RESULTADOS.md).

**T204 (histórico):** RA1 semántico (ADR-0036), ajustado en T205/T206/T207.
[Pruebas, instalación y límites](../reviews/evidence/T204/RESULTADOS.md).
**T203:** editor sin clase e Inicio actualizados; compilado. [Evidencia](../reviews/evidence/T203/RESULTADOS.md).
**T187:** éxitos verdes 5 s y errores persistentes; incluida en compilación local.
[Evidencia](../reviews/evidence/T187/RESULTADOS.md). T187/T203/T204/T205/T206/T207 sin publicar.
Auditoría anterior autorizada por Adrià:
- **T194:** nota final completa aunque quede un diagnóstico sin peso.
- **T195/T196:** clases e informes privados; originales/enlaces conservados.
- **T199:** rechazo real de sudo sin ejecutar ni producir suspenso.
- **T201:** actualizador por red Chromium; [evidencia](../reviews/evidence/T201/RESULTADOS.md).
- **T198:** controles, paquetes e instalación Ubuntu 24/26 correctos;
  [evidencia](../reviews/evidence/T198/RESULTADOS.md).
- **T200:** versiones recuperables privadas; [evidencia](../reviews/evidence/T200/RESULTADOS.md).
**T197/T202:** versión pública 1.0.1 (`a5ccaf9`), controles remotos y assets
verificados. [Publicación](../releases/1.0.1/PUBLICACION.md). La compilación local
T204 conserva ese número nominal; se distingue por revisión de comprobador y
huellas de instalación. No equivale a una publicación ni a validación de aula.

## Problemas conocidos y límites
- RA1 no evalúa el cliente ni su registro. Kea valida archivo guardado;
  gateway/DNS son opciones declaradas, no la configuración efectiva del cliente.
- Si un consumidor no lee, puede faltar progreso y `run.end`; el resultado
  guardado mantiene la nota. La GUI trata un flujo sin cierre como incompleto.
- Copias de notas: 128 MB es heap V8 probado, no RSS ni cualquier examen.
- Fuentes: 50 versiones por origen, máximo 4 MiB, privadas y sin red. Clases
  contienen su contraseña. No protegen de perder el disco (ADR-0030/0034).
- Laboratorio en 127.1.2.3; arneses SSH/secretos secuenciales. Sin sudo: 2298.
- Reintentos: mismo PLAN, 50 eslabones. Examen: mínimo 5 min.
- Hasta 2000 celdas, 1 MiB de metadatos e inventario de 65536 bytes.
- Cierre normal espera resultado/copia; cierre forzado puede interrumpirlo.
- Linux x64; actualización automática AppImage y .deb con nueva instalación.
- Editor conserva texto; Monaco diferido local. Examen-lab desfasado (T186).
- Si examen/clase cambiaron tras corregir, hay que corregir antes de enviar.
- Un informe que contenga la contraseña de la clase no se envía.
- Electron 43.8.3 incorpora Node 24.22.0; red actualizador mitigada, runtime
  pendiente. npm: 8 moderados build con excepción específica.

## Siguiente trabajo
T070 sigue READY: T204 repara solo RA1, no todos los exámenes. T084 queda para
prueba de aula de Adrià. T023 y T186 siguen READY. No hay publicación autorizada
para estos cambios nuevos.
