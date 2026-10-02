# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-10-02 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**T127–T144 · Reparación de las 18 incidencias de la auditoría.**

- A01–A18 reparadas, con commits separados y regresiones.
- Notas: no se decide sin evidencia; ausencia exige exit 0; pesos finitos y
  pendientes positivos sin tolerancia; mejor vuelta por peso sin redondear.
- SSH: contexto en todas las fases, supervisor fijo y terminación confirmada;
  cancelación local publica UNKNOWN. ADR-0024 y ADR-0025.
- Editor: se valida y guarda el borrador visible, errores conservados,
  aviso de cambios pendientes y pesos decimales/cero editables.
- Datos: clases corruptas bloquean escritura; lectura de artefactos comprueba
  coherencia; metadata textual redactada sin alterar referencias estructurales.
- Copias: últimas 50 por fecha real, trabajo asíncrono y aviso de fallo.
- GUI: contraste AA en los estados auditados y actualización cancelada al
  empezar una corrección, con presupuesto de tiempo y tamaño.
- Pruebas, paquetes y límites: `docs/audits/2026-10-02/REPARACION.md`.
- AppImage y .deb locales reconstruidos. Versión sigue en 0.9.0; sin publicación.

## Problemas conocidos y límites

- Laboratorio en **127.1.2.3**, nunca 127.0.0.x.
- Un reintento exige el mismo PLAN. Intervalo mínimo del modo examen: 5 min.
- El proyector no tapa los nombres del alumnado: el profesor eligió la clase.
- La copia guarda notas y comprobaciones, no las salidas de las máquinas;
  una corrección recuperada explica esa falta de evidencia.
- Paquete Linux x64; Windows y macOS quedan fuera.
- Actualización automática solo para AppImage; el .deb lo lleva apt.
  Sin release publicada para probar una actualización real.
- Editar mediante el formulario vuelve a formatear el YAML y sus comentarios;
  guardar el YAML directamente conserva su texto exacto.
- Autenticación por clave SSH pendiente (T023).

## Siguiente tarea recomendada

**T070** (exámenes del curso en formato nativo) desbloquea **T084**:
examen real de aula de principio a fin, que ejecuta Adrià antes de la 1.0.0.
