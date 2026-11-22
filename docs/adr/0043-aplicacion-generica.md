# ADR-0043 · Aplicación genérica y criterios propios del examen

Aceptada el 22 de noviembre de 2026. Sustituye la incorporación de RA1 al
motor decidida en ADR-0036. El producto distribuye las herramientas de
evaluación. Cada profesor conserva sus exámenes, respuestas y comprobadores.

Las comprobaciones ordinarias se describen por completo en el YAML. Para
una práctica que requiere un programa especializado se mantiene el contrato
de `checker`. El programa procede de la configuración del profesor en
`$XDG_CONFIG_HOME/heimdall/checkers/<perfil>/<sha256>/` (por defecto,
`~/.config/heimdall/checkers/` más el perfil y la revisión). La carpeta
contiene `checker.py` y `criteria.json`, con la lista `criteria` y el entero
`arguments` que indica cuántos argumentos siguen al criterio. El profesor
instala únicamente programas de confianza: se ejecutan en el equipo evaluado
con los permisos de la comprobación, incluido sudo cuando está declarado.

El motor verifica la revisión y conserva sus bytes durante la corrección.
La ausencia o alteración del perfil detiene la preparación antes del SSH.
Los pesos, las huellas del plan y la clasificación de resultados mantienen
su significado. Los dos perfiles históricos de RA1 y sus pruebas específicas
se conservan con el material del curso, fuera del paquete de escritorio.
