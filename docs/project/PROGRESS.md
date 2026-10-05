# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.
**Actualizado**: 2026-10-05 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**T169 · Los errores de lectura ya no parecen ausencia de resultados.**

- Base: `36e869d`, árbol limpio. El arnés T166 reprodujo F3: carpetas sin
  permiso aparecían vacías y una copia corrupta parecía inexistente.
- ENOENT sigue siendo ausencia; otros errores muestran ruta y causa en el
  histórico o en copias. Los archivos sanos siguen visibles junto a los malos.
- Restaurar recupera copias independientes válidas y avisa de las dañadas;
  nunca ofrece ni publica una cadena incompleta. No sobrescribe originales.
- [Evidencia T169](../reviews/evidence/T169/RESULTADOS.md): permisos EACCES,
  copia corrupta, mezcla válida/inválida y restauración con archivo inválido.
- `make check`, `go test -race ./...`, `make test`, `make gui-check gui-build`
  (531 pruebas), `make gui-lab` y `make docs-check tools-check` correctos. GUI
  fuera del aislamiento por `EAI_AGAIN localhost`; sin cambios en notas,
  publicación ni push.

**Contexto anterior:** T168 redujo la memoria de copias en `36e869d`; T167
resolvió F1 en `7fd7948`. T166 auditó la base 572d9eb; informe y arneses en
[T166](../reviews/T166-AUDITORIA.md). La distribución pública 0.9.1 está
verificada en [VERIFICACION](../releases/0.9.1/VERIFICACION.md).

## Problemas conocidos y límites

- Si un consumidor no lee, puede faltar progreso y `run.end`; el resultado
  guardado mantiene la nota. La GUI trata un flujo sin cierre como incompleto.
- Sigue F4 (parciales/PLAN, T170/T171). No se encadenó en esta sesión.
- La copia sigue leyendo cada original para validar cambios y corrupción; el
  límite de 128 MB probado es del heap V8, no del RSS ni de cualquier examen.
- El .deb se ejecutó extraído, sin instalarlo: sudo requiere contraseña.
- Laboratorio en 127.1.2.3; arneses SSH y secretos se ejecutan secuencialmente.
- Reintentos: mismo PLAN y máximo 50 eslabones. Modo examen: mínimo 5 min.
- Hasta 2000 celdas y 1 MiB de metadatos resueltos; inventario hasta
  65536 bytes. PLAN no admitido se rechaza antes de SSH.
- Copias conservan notas y procedencia, sin salidas. Recuperación no sobrescribe.
- Cierre normal espera resultado y copia; cierre forzado puede interrumpirlo.
- Linux x64. Actualización automática solo AppImage; .deb mediante apt.
- Editor formulario reformatea YAML; edición directa conserva texto.
  Autenticación por clave SSH pendiente (T023), sin caso de uso aún.

## Siguiente trabajo

**T170**: reducir trabajo repetido al guardar parciales, sin perder su
protección ante la muerte del proceso. Partir de este commit limpio, leer
`python3 scripts/tasks.py T170` y el hallazgo F4 de
`docs/reviews/T166-AUDITORIA.md`. Después queda T171, en otra sesión crítica.
**T070** sigue desbloqueando **T084**, examen real de aula que ejecuta Adrià.
