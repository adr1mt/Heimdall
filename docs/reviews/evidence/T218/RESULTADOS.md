# T218 · RA1 v2 guardado en Heimdall

27 de octubre de 2026. Petición docente: examen separado «RA1 v2»,
12 comprobaciones y peso 19; las siete de Kea con peso 2. Encaminamiento
limitado a `net.ipv4.ip_forward=1` guardado en sysctl. Sin NAT ni consulta
del valor activo. DNS DHCP `8.8.8.8`.

## Resultado

- [Examen mantenido](../../../../exams/ra1-v2/examen.yaml) y tabla privada
  de criterios en su [README](../../../../exams/ra1-v2/README.md).
- Copia de uso en `/home/adr1/apps/0227/heimdall/ra1-v2/examen.yaml`.
  Registrada en primer lugar en los recientes de Heimdall con nombre «RA1 v2».
  Registro y guardado mediante las funciones nativas de proyectos y copias
  recuperables, con lectura posterior de la copia y comparación exacta.
- El corrector mantiene la revisión original intacta y añade una revisión fija
  que difiere únicamente en el DNS DHCP esperado. No se añaden argumentos,
  lenguaje ejecutable en YAML ni perfiles abiertos. Selección por SHA-256
  completo y rechazo de cualquier revisión desconocida antes de conectar.
- Motor instalado en el AppImage existente. Comparación de todos sus archivos:
  solo cambia `resources/heimdall`; `app.asar` y la interfaz instalada se conservan.
  Copia previa de AppImage y registro de exámenes sincronizadas y verificadas.
  [Manifest de instalación](instalacion-local.json).
- El examen original conserva exactamente sus bytes y sigue siendo aceptado.
  Clases, contraseñas, correcciones e informes sin cambios.

## Verificación

- `GOCACHE=/tmp/heimdall-go-cache make check ra1-check build`: correcto.
  Suite Go completa y 30 regresiones Python del corrector original.
- Regresión nueva ejecuta las dos fuentes Python reales con adquisición de
  configuración simulada: DNS heredado, sobrescritura de subred incorrecta,
  opción binaria por código y rechazo de un DNS adicional. Original exige
  `9.9.9.9`; v2 exige `8.8.8.8`. Fuente original y huella histórica intactas.
- Prueba del examen real v2: 12 comprobaciones, peso 19, siete Kea con peso 2,
  único encaminamiento `fwd-persistent`, sin NAT ni concesiones del cliente.
- Validación nativa sin clase de los dos exámenes y [PLAN ficticio](plan.txt)
  v2: correcto; repetido con el motor extraído del paquete final.
- `make docs-check tools-check`: correcto; 10 pruebas de herramientas.
- AppImage instalado idéntico al paquete comprobado; motor y GUI verificados
  por huellas. Examen guardado idéntico a la copia mantenida y recuperable.

No se corrige alumnado ni se reinicia el programa. Si Heimdall estaba abierto,
hay que cerrarlo y abrirlo para cargar el nuevo corrector y refrescar recientes.
No se publica. Los límites de Netplan/Kea declarados se conservan; la validación
no certifica la configuración efectiva de un cliente ni una corrección de aula.
El trabajo paralelo T219 puede actualizar la interfaz conservando este motor;
su instalación tendrá su propia evidencia posterior.
