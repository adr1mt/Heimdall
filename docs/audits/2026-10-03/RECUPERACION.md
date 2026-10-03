# T159 · Reparación de la recuperación de copias

Fecha: 2026-10-03. Base: `1d1f3fe`, árbol inicialmente limpio.
Alcance: recuperación de copias; sin datos reales, empaquetado o publicación.

## Reproducción antes de reparar

Comando desde `gui/`:

```bash
npm test -- --reporter=verbose tests/backup-recovery.test.ts
```

Resultado observado sobre el código anterior: **2 controles pasan, 3 pruebas
fallan**. Las primeras cinco pruebas se escribieron antes de tocar la función.

- Sustitución de copia: tras validar HEAD → ROOT, un segundo proceso sustituye
  atómicamente HEAD por un artefacto individualmente válido que referencia
  MISSING. La recuperación anterior escribe el texto cambiado y anuncia
  `restored: 2, kept: 0`; la comparación exacta detecta el antecedente cambiado.
- Original concurrente: antes de renombrar el temporal, otro proceso crea el
  original completo con salidas. Resultado anterior `restored: 1, kept: 0`,
  frente al esperado `restored: 0, kept: 1`; la copia sustituye al original.
- Orden: el directorio enumera HEAD antes que ROOT. Se intenta publicar HEAD
  sin que ROOT exista todavía; la comprobación del antecedente falla.

Las pruebas importan la restauración real. Los envoltorios de fs solo detienen
la ejecución en los límites pertinentes y delegan las operaciones al sistema
real. En las dos intercalaciones, A ejecuta restoreBackups y espera mediante
spawnSync; B escribe los archivos y confirma su PID distinto antes de que A
continúe. Tiempo máximo de B: 5 s. Sin retardos ni resultados de fs simulados.
Los controles recorren los mismos puntos sin la intervención del escritor.
Cada caso usa su directorio temporal nuevo y se elimina al terminar.

## Reparación

Cada copia se lee y valida una vez; su texto exacto se prepara de forma
exclusiva en un directorio privado dentro de var/. Se retienen sus resultados
para validar todas las cadenas antes de publicar ninguna corrección. Se
mantiene el lector compartido de 64 MiB y solo un texto adicional por lectura.

Las cadenas definen el orden de publicación de antecedentes a reintentos,
deduplicando miembros compartidos. linkSync publica el archivo completo sin
reemplazar ninguna entrada existente. EEXIST conserva el original y aumenta
kept; otros errores se propagan. La comprobación inicial existsSync es una
optimización, no la protección frente a escrituras concurrentes.

finally elimina los temporales privados. La copia de origen no se modifica.
Un error durante publicación puede dejar antecedentes completos ya publicados,
pero ningún nuevo reintento sin su antecedente por el orden de esta operación.
No se añade rollback ni se elimina ninguna corrección publicada.

## Validación final

- `npm test`: **525 pruebas correctas, 33 archivos**.
- 9 pruebas nuevas: ambos defectos con/sin escritor; orden de publicación;
  rechazo global de cadena inválida antes de publicar; limpieza y error real
  al preparar un temporal; limpieza y error real al publicar tras un
  antecedente correcto; conservación de enlace simbólico roto existente.
- Texto exacto, referencias, PLAN y evidencia del original comprobados.
- Regresiones anteriores de ciclos, identidad, PLAN, límites 49/50/51,
  corrupción, rotación y conservación de originales siguen pasando.
- `npm run typecheck` y `npm run build`: correctos; preload verificado.
- `GOCACHE=/tmp/heimdall-t159-go-cache make check`: correcto.
- `git diff --check`: correcto.

La primera prueba de fallo al preparar un temporal esperaba EISDIR, pero la
apertura exclusiva devuelve EEXIST cuando la ruta es un directorio. Se corrigió
esa expectativa antes de repetir la suite: se conserva la comprobación de
error visible y limpieza completa. El fallo no estaba en la reparación.

Vitest no arranca dentro del aislamiento por `getaddrinfo EAI_AGAIN localhost`;
las pruebas se ejecutaron fuera de él. No se usó el aula ni credenciales reales.

## Límites

La publicación necesita enlaces duros en el sistema de archivos del destino;
si no los soporta, se informa del error sin fallback que sobrescriba o publique
un archivo parcial. No se promete protección contra otro escritor que elimine
o cambie los originales después de recuperarlos. Un cierre forzado puede
abandonar temporales privados; el histórico no los considera correcciones.
La prueba completa de la aplicación empaquetada corresponde al trabajo de
reconstrucción de paquetes, fuera de esta tarea.
