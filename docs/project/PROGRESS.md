# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.
**Actualizado**: 2026-10-22 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**T203:** validar y guardar exámenes ya no exige clase; el PLAN completo sigue
obligatorio al corregir. Inicio muestra el nombre recién guardado. 582 pruebas
GUI, motor/race y arnés real correctos. [Evidencia](../reviews/evidence/T203/RESULTADOS.md).
**T187:** éxitos verdes durante 5 s, errores persistentes.
[Evidencia](../reviews/evidence/T187/RESULTADOS.md). T187/T203 pendientes de publicación.
Auditoría anterior autorizada por Adrià:
- **T194:** una nota final ya no parece incompleta por un diagnóstico sin peso.
- **T195/T196:** clases privadas, migración de permisos e informes SSH 0600;
  originales, directorios y destinos de enlaces conservados (ADR-0033).
- **T199:** sudo probado con contraseña incorrecta real, usuario sin privilegios
  y máquina sin sudo. El rechazo no ejecuta el comando ni produce suspenso.
- **T201:** actualizador por red de Chromium. Brotli real, renderer y preload
  con sandbox/fallback comprobados. [Evidencia](../reviews/evidence/T201/RESULTADOS.md).
- **T198:** barreras race/Go/npm y workflow manual de publicación. Integración
  completa, 100 ficticios, .deb instalado/retirado en Ubuntu 24/26 y AppImage
  correctos. [Evidencia y límites](../reviews/evidence/T198/RESULTADOS.md).
- **T200:** versiones privadas recuperables de clases y YAML (ADR-0034).
  Examen como borrador; clases con confirmación y original conservado incluso
  corrupto. 571 pruebas GUI; arnés real y capturas claro/oscuro.
  [Evidencia](../reviews/evidence/T200/RESULTADOS.md).
**T197/T202:** 1.0.1 publicada. Checks y Release validation correctos sobre
`a5ccaf9`; 574 pruebas GUI, Go 1.26.10 y race, paquetes y entrega 0600 correctos.
Feed público, etiqueta y sumas comprobados. [Publicación y evidencia](../releases/1.0.1/PUBLICACION.md).
CI omite sandbox real por su kernel; ese modo sí pasó localmente.

**T189:** sudo por stdin, 0227 migrado; Manuel Cadenas (2026-10-21):
prova-guia-kea 100/100, ra1-dhcp-kea 34/100, sin fallos por permisos.

## Problemas conocidos y límites

- Si un consumidor no lee, puede faltar progreso y `run.end`; el resultado
  guardado mantiene la nota. La GUI trata un flujo sin cierre como incompleto.
- La copia de notas lee originales para validar cambios/corrupción; 128 MB
  probado es heap V8, no RSS ni cualquier examen. Sin salidas; no sobrescribe.
- Fuentes: hasta 50 versiones por origen, máximo 4 MiB. Clases y copias incluyen
  su contraseña (ADR-0030), privadas y sin red. No protegen de perder el disco.
- Laboratorio en 127.1.2.3; arneses SSH/secretos secuenciales. Sin sudo: 2298.
- Reintentos: mismo PLAN, máximo 50 eslabones. Modo examen: mínimo 5 min.
- Hasta 2000 celdas y 1 MiB de metadatos; inventario hasta 65536 bytes.
- Cierre normal espera resultado/copia; cierre forzado puede interrumpirlo.
- Linux x64. Actualización automática AppImage; .deb instalando nueva versión.
- Editor YAML conserva texto; Monaco en chunk diferido local.
- T023 (clave SSH) sigue sin caso real; examen-lab desfasado (T186).
- Si examen/clase cambiaron tras corregir, hay que corregir antes de enviar.
- Un informe que contenga la contraseña de la clase no se envía.
- Electron 43.8.3 aún incorpora Node 24.22.0; mitigada red del actualizador,
  pendiente parche del runtime. npm: 8 moderados build con excepción específica.

## Siguiente trabajo

**T202 cerrada:** 1.0.1 publicada; Adrià hará la prueba de clase (T084 pendiente).
**T070** desbloquea **T084**, examen real de aula que ejecuta Adrià. Consultar
`python3 scripts/tasks.py T070`. T023 y T186 siguen READY.
