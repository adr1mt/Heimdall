# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.
**Actualizado**: 2026-10-27 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**T216:** portátil compacto: lateral contraíble/automático, escala 80–120 %
persistente, nombres completos, matriz proporcionada y resumen explícito.
Corregir prioriza progreso; proyector sin oscilación al ajustar muchas columnas.
615 pruebas GUI, motor, tipos, build y arneses aislados correctos.
[Evidencia y límites](../reviews/evidence/T216/RESULTADOS.md). Sin instalar.
T211–T213 conserva [su evidencia](../reviews/evidence/T211-T213/RESULTADOS.md).
**T215 instalado:** todos reciben su informe como `informe.html`; el siguiente
envío sustituye al anterior. [Instalación](../reviews/evidence/T215/RESULTADOS.md).
Copia anterior conservada. Cerrar/abrir al terminar de corregir; sin reinicio.
T214 conserva la [instalación anterior](../reviews/evidence/T214/RESULTADOS.md).
La privacidad entre alumnos requiere credenciales SSH propias; la contraseña
común del aula no impide acceder a máquinas ajenas.

**T210:** interfaz T208 instalada con motor T209 conservado y copia anterior.
[Instalación](../reviews/evidence/T210/RESULTADOS.md).
**T208:** ocultos, Evaluados y orden; [evidencia](../reviews/evidence/T208/RESULTADOS.md).
**T209:** Kea con identidad del servicio; fallos técnicos separados de errores
reales. AppImage/examen instalados con originales; requiere nueva corrección.
[Evidencia](../reviews/evidence/T209/RESULTADOS.md).
**T204–T207:** RA1 semántico, 19 criterios/peso 24; cuatro reservas juntas,
peso 2. [Último ajuste](../reviews/evidence/T207/RESULTADOS.md).
**T203:** editor sin clase e Inicio actualizados; compilado.
**T187:** éxitos verdes 5 s y errores persistentes, compilados.
**T194–T201:** nota final sin diagnósticos sin peso, clases/informes privados,
sudo y actualizador endurecidos, versiones recuperables y paquetes verificados.
**T197/T202:** pública 1.0.1 (`a5ccaf9`), [publicación](../releases/1.0.1/PUBLICACION.md).
Las compilaciones locales conservan ese número nominal; no equivalen a una
publicación ni a validación de aula. T187/T203–T213 sin publicar.

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
