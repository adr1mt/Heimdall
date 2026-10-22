# T192 · Cabecera sin etiquetas académicas repetidas

Petición de Adrià, continuación de T191. Base: `56dead3`.

Se retiran los textos visibles «Aprobado» y «Suspenso» bajo la nota de la
matriz. Se conservan número, escala y color; la etiqueta accesible del grupo
y su tooltip mantienen el estado completo. Los estados provisional, incompleto,
sin evaluar y excluido conservan su explicación visible. Lista, detalle,
cálculos y filtros no cambian.

Validación: make check, tipos node/web/tests, 549 pruebas GUI, build y
verificación del preload correctos. Arnés existente de Resultados correcto:
5/30 alumnos, tres tamaños, ambos temas, scroll, filtros, orden y detalle.
[Prueba de geometría e interacciones](proof.json).

Cabecera revisada visualmente en [claro](5-1440-light.png) y
[oscuro](5-1440-dark.png); [Sin evaluar](incomplete.png) conserva su aviso.
La verificación usa datos ficticios y un perfil temporal de Electron.
