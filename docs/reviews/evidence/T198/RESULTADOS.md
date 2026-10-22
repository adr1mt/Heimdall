# T198 · Barreras previas a publicación

2026-10-22. Los workflows editados aún **no se han ejecutado en GitHub**.
Validación local del mismo recorrido sobre el árbol posterior a T201 y el
paquete 1.0.0 existente; T197 debe repetir los paquetes con 1.0.1.

- `go test -race ./...`: correcto.
- govulncheck 1.9.0: cero vulnerabilidades alcanzables. El Go efectivo de este
  equipo fue 1.27.2, superior al mínimo de go.mod; apareció GO-2026-6809 en
  crypto/x509 no llamado y GO-2026-5932 en el módulo x/crypto (openpgp no usado).
  El escaneo del paquete 1.0.1 debe usar también su toolchain de construcción.
- npm audit contra registry.npmjs.org: ocho moderados de la cadena de
  electron-builder, todos originados por GHSA-hp3w-g68c-fv3c. El verificador
  admite solo ese aviso en nodos dev; regresiones bloquean otro aviso en el
  mismo paquete, severidad alta, dependencia de producción e informe fallido.
- `make test`: integración SSH, secretos, aceptación, eventos, tubería llena,
  sesión, RA2 y carga de 100 alumnos ficticios correctos. Incluye sudo erróneo
  real y máquina sin sudo. Arneses secuenciales.
- AppImage 1.0.0 extraído: AppRun con cuatro combinaciones de namespaces y
  opción explícita; renderer y preload reales en modo automático, sandbox y
  fallback, con perfiles ficticios aislados.
- .deb 1.0.0 instalado y retirado realmente dentro de contenedores Ubuntu
  24.04 y 26.04. Motor incluido y versión comprobados. No se instaló en el host.
- Ambos workflows parseados como YAML; nueve pruebas de herramientas correctas.

La excepción npm se revisa en cada publicación. No se ejecuta audit fix --force
ni se rebaja el empaquetador para ocultar el aviso. govulncheck no examina Node
ni Chromium; esa evaluación está en T201. La ejecución de aula sigue siendo
T084 y no queda sustituida por los 100 alumnos ficticios.
