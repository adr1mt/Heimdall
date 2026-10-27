# ADR-0036 · Comprobador fijo y versionado para RA1

- Estado: **aceptada** · 2026-10-27 · tarea T204
- Amplía ADR-0003 y ADR-0032. No añade un lenguaje de examen.

## Contexto

La revisión del examen real de RA1 demuestra falsos suspensos por orden de
propiedades y falsos aprobados por datos de reservas vecinas, comentarios,
pools diferentes y reglas nftables que no se aplican. Aumentar ventanas de texto
no resuelve la asociación semántica. El alumnado ve las descripciones del informe.

## Decisión

Añadir `comprobador:` como alternativa a `cmd:` y `valor:`, exclusivamente para
el perfil cerrado `ra1-dhcp`. Es una lista de seis argumentos: perfil, SHA-256
del programa fijo incorporado al motor, criterio conocido, interfaz externa,
interfaz interna e IP de examen. Solo admite los 31 criterios del examen real y
`igual_a: OK`. No acepta código, rutas de programas ni expresiones del profesor.

El PLAN valida perfil, revisión, criterio, referencias, host y sudo antes de
conectar. El archivo YAML de versiones anteriores se rechaza como desconocido
en motores antiguos: nunca se ejecuta a medias con notas falsas. La GUI conserva
el perfil al alternar YAML y formulario; representa su vector con el prefijo
reservado `heimdall:comprobador`, que no es un ejecutable local ni remoto.

El motor envía el programa Python fijo por SSH como vector literal, con `-I`
para aislar módulos del usuario. Los argumentos del alumnado van aparte y nunca
se interpolan en el programa. No se instala ni copia ningún archivo al alumno.
Se reutilizan sudo, límites de tiempo, cancelación y clasificación existentes.
No se evalúa Python en el equipo del profesor ni se añade dependencia Go.

El programa responde exactamente `OK` o `FAIL`, ambos con salida 0. Cualquier
otra respuesta, falta del intérprete, permiso rechazado o construcción no
soportada se clasifica como `UNEVALUATED/ENGINE_ERROR`, con evidencia y explicación
privadas. No se cambia `model.Classify`: los comandos ordinarios conservan su
semántica, incluido el código 127 académico. No hay códigos mágicos aplicados a
programas arbitrarios ni un preflight de peso cero que simule ser una barrera.
Cada criterio comprueba sus propias capacidades antes de emitir una decisión.

El artefacto conserva el vector declarativo con la revisión SHA-256: identifica
el programa completo reproducible sin multiplicar su texto por alumno y criterio.
El hash del PLAN incluye la revisión y el indicador de comprobador; omite ese
indicador cuando no se usa, conservando los hashes existentes.

Kea se valida con su propio parser y se lee estructuralmente respetando strings,
comentarios, inclusiones y comas adicionales. Netplan se consulta combinado y se
contrasta con el estado activo. El archivo nftables se carga solo con `unshare(CLONE_NEWNET)`, precedido de una prueba de capacidad: no se cambia el ruleset del host.
Las reglas JSON se interpretan para los flujos representativos documentados;
una expresión relevante desconocida queda sin evaluar, nunca se presume correcta.

## Consecuencias y límites

- El examen sigue siendo declarativo y no permite programas escritos en YAML.
- Las correcciones del programa generan una revisión nueva; examen y motor
  incompatibles se detienen durante el PLAN y no abren conexiones.
- Las descripciones públicas se neutralizan; criterios e IDs permanecen privados
  en los materiales del profesor y mantienen los pesos del examen.
- No se promete equivalencia de cualquier programa nftables: se admite un
  subconjunto probado y se informa de los casos no soportados.
- Sin acceso al cliente, solo se prueba una concesión vigente del rango en el
  registro de Kea; no su configuración efectiva ni su resolución de nombres.
- No se cierra T070 ni la validación de aula T084 por este examen individual.
