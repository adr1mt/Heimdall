# ADR-0024 · Distinguir la terminación del comando del límite remoto

- Estado: **aceptada** · 2026-10-02
- Amplía ADR-0010 y `05-SECRETOS-TIMEOUTS-REINTENTOS.md`; evidencia: auditoría A03.

El código de coreutils `timeout` no distingue por sí solo un comando que devuelve
124/137 de un límite agotado. Se usa un supervisor POSIX fijo dentro de timeout.
Invoca el vector mediante `"$@"`, sin interpolar los argumentos en el programa,
y emite al terminar un registro privado con nonce aleatorio y código de salida.
El lector consume ese registro, incluso tras el límite de evidencia de stderr.

124 o 137 sin registro de terminación representan el límite remoto; con registro
son códigos académicos ordinarios. Una salida incompleta o un registro incoherente
no permite evaluar. La cancelación local y la pérdida de conexión no confirman
muerte remota. Los límites de memoria y salida se conservan.

Excepción acotada a la regla «sin shell»: el supervisor remoto tiene texto fijo;
los comandos del profesor siguen siendo vectores literales. El cliente SSH ya
entrecomilla cada argumento para el shell que normalmente usa el servidor.
