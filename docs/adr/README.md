# Registro de decisiones de arquitectura

Solo decisiones **cerradas**. Lo que sigue abierto está en
[`../design/08-DECISIONES-ABIERTAS.md`](../design/08-DECISIONES-ABIERTAS.md).

| ADR | Decisión |
|---|---|
| [0001](0001-go-como-motor.md) | Go como lenguaje del motor, binario único |
| [0002](0002-plan-previo-a-ejecucion.md) | Fase PLAN antes de tocar ninguna máquina |
| [0003](0003-yaml-declarativo.md) | Examen declarativo en YAML, sin lenguaje ejecutable |
| [0004](0004-denominador-fijo.md) | Denominador fijo y parametrización sin decisión |
| [0005](0005-taxonomia-estados.md) | PASS / FAIL / UNEVALUATED más causa técnica |
| [0006](0006-incompletas-sin-nota-final.md) | Una evaluación incompleta no produce nota final |
| [0007](0007-json-canonico.md) | Un único modelo canónico en JSON |
| [0008](0008-compat-teuton-temporal.md) | ~~Compatibilidad con Teuton como adaptador temporal~~ · sustituida por 0016 |
| [0009](0009-politica-de-secretos.md) | Los secretos van por stdin y nunca al resultado |
| [0010](0010-ssh-nativo.md) | SSH nativo con `x/crypto/ssh`, no el binario `ssh` |
| [0011](0011-identidad-de-las-maquinas.md) | La identidad de la máquina se fija por ejecución, no entre cursos |
| [0012](0012-topes-de-concurrencia.md) | Dos topes de concurrencia: 8 alumnos a la vez, 4 conexiones por máquina |
| [0013](0013-alumnos-en-paralelo.md) | 16 alumnos en paralelo, medido; cierra D-6 |
| [0014](0014-nombre-heimdall.md) | El producto se llama Heimdall; cierra D-7 |
| [0015](0015-causa-salida-desbordada.md) | Novena causa técnica: `OUTPUT_OVERFLOW` |
| [0016](0016-heimdall-independiente-de-teuton.md) | Heimdall es un producto independiente, con GUI propia; sustituye a 0008 |
| [0017](0017-contrato-nativo-ndjson.md) | Contrato nativo motor ↔ GUI: eventos NDJSON y esquema del artefacto; cierra D-9 |
| [0018](0018-reintento-de-lo-no-evaluado.md) | Ante un incompleto: dejar pendiente o repetir solo lo no evaluado; cierra D-8 |
| [0019](0019-consolidacion-de-una-cadena.md) | Consolidar una cadena de correcciones; la nota la sigue calculando el motor |
| [0020](0020-sesion-de-examen.md) | La sesión de examen: la mejor nota completa y el estado `FINISHED`; cierra D-10 |
| [0021](0021-datos-propios-de-la-gui.md) | Los datos propios de la aplicación: dónde viven, escritura atómica y ninguna contraseña |
| [0022](0022-aula-generada-derivada-de-la-clase.md) | El aula que escribe la aplicación es un artefacto derivado de la clase, con nombre reservado |
| [0023](0023-la-contrasena-del-aula-se-recuerda-cifrada.md) | La contraseña del aula se recuerda cifrada (sustituida por ADR-0030) |
| [0024](0024-evidencia-de-terminacion-remota.md) | Supervisor remoto fijo que distingue timeout y códigos propios 124/137 |
| [0025](0025-integridad-en-los-limites-de-evidencia-y-peso.md) | Prueba suficiente para evaluar, pesos finitos y elección sin redondear |
| [0028](0028-lecturas-compartidas.md) | Captura compartida (sustituida por ADR-0029) |
| [0029](0029-retirar-lecturas-compartidas.md) | Retirada de lecturas compartidas para simplificar la autoría |
| [0030](0030-contrasena-por-clase.md) | La contraseña de las máquinas se guarda en cada clase |
| [0031](0031-informe-en-la-maquina-del-alumno.md) | El informe de cada alumno se deja en su máquina, solo ese fichero |
| [0032](0032-sudo-en-las-comprobaciones.md) | Comprobaciones con `sudo: true`: contraseña de la clase por stdin, nunca en el examen |

- [ADR-0033 · Informes privados del alumno](0033-permisos-privados-de-informes.md).

- [ADR-0034 · Versiones recuperables de clases y exámenes](0034-copias-de-clases-y-examenes.md).

- [ADR-0035 · Validación del examen independiente de la clase](0035-validar-examen-sin-clase.md).

- [ADR-0036 · Comprobador fijo y versionado para RA1](0036-comprobador-acotado-ra1.md).

- [ADR-0037 · Informes individuales y acceso desde Ubuntu Desktop](0037-informes-individuales-y-acceso-desktop.md).

- [ADR-0038 · Nombre fijo del último informe](0038-nombre-fijo-del-informe.md).

- [ADR-0039 · Sesiones persistentes, cierre e informes definitivos](0039-sesiones-persistentes-y-cierre-definitivo.md).
