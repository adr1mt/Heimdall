# ADR-0010 · SSH nativo con `x/crypto/ssh`, no el binario `ssh`

- Estado: **aceptada** · 2026-09-20
- Cierra: **D-2** de `08-DECISIONES-ABIERTAS.md`
- Contexto: `07-PROTOTIPO.md` §6 (criterios A-5, A-6 y A-11),
  `ACEPTACION-FASE1.md`, `PERFORMANCE.md` §6

## Contexto

La recomendación inicial era SSH nativo, pero se dejó abierta a propósito: no
había ni una medición, porque Go ni siquiera estaba instalado. La alternativa
era delegar en el binario `ssh` del sistema, como hace Teuton con Net::SSH y su
salto por pasarela.

La rebanada vertical (T012) ya ejecuta contra el laboratorio y deja medir.

## Decisión

El transporte es `golang.org/x/crypto/ssh` dentro del proceso. No se invoca el
binario `ssh` del sistema ni ningún otro programa externo para conectar.

## Evidencia

Medido el 2026-09-20 contra `alu1` en `127.1.2.3:2201`, Go 1.27.1, dos alumnos,
cinco comprobaciones, concurrencia 2. Salida literal en `ACEPTACION-FASE1.md`.

- **A-11**: cada ejecución registra `transport: "ssh"` y devuelve el hostname
  del contenedor. Nada se ejecuta en la máquina del profesor, que es justo el
  fallo F-01 de Teuton con cualquier dirección `127.0.0.x`.
- **A-5**: un examen con un `sleep 30` y un alumno inalcanzable termina en
  **4,8 s** (4,4 s en la corrida de T012). El comando lento corta a su timeout (3005 ms sobre 3000) y sale
  `UNEVALUATED/TIMEOUT`; el alumno inalcanzable cierra con `CONNECT_FAILED`
  tras tres intentos.
- **A-6 / `PERFORMANCE.md` §6.2**: la memoria del motor no depende de lo que
  escupa el alumno. Con una salida de 1 / 20 / 100 / 300 MB el RSS máximo es de
  13,4 / 13,1 / 13,8 / 15,5 MB, y en los tres últimos casos el lector corta en
  seco alrededor de 8,4 MB leídos, conservando 64 kB y contabilizando el total.
- **`PERFORMANCE.md` §6.4 (parcial)**: el primer artefacto parcial es visible a
  los **3,2 s**, y el definitivo a los **4,6 s**. La GUI puede pintar antes de
  que termine el run.

## Por qué no el binario `ssh`

1. **Los límites de salida dejarían de ser del motor.** El corte a 64 kB por
   flujo y el corte duro a 8 MB se aplican sobre el canal, en memoria. Con un
   proceso externo habría que tuberlo y el RSS plano dejaría de estar
   garantizado por construcción.
2. **La nota dependería del equipo del profesor.** Versión de OpenSSH,
   `~/.ssh/config`, agentes, alias de host y mensajes localizados entrarían en
   el resultado. F-08 exige lo contrario.
3. **Los secretos volverían a acercarse a `argv`.** ADR-0009 prohíbe el camino
   y un binario externo lo reabre.
4. **Las causas técnicas se perderían.** Nativo distingue `CONNECT_FAILED` de
   `AUTH_FAILED` por el tipo de error; con el binario habría que interpretar
   texto en inglés.
5. **No habría binario único.** ADR-0001 lo exige para repartir el motor al
   aula sin instalar nada.

El coste aceptado es que `known_hosts`, agentes y `ProxyJump` se implementan a
mano si algún día hacen falta. `ProxyJump` está fuera del núcleo y la política
de `known_hosts` sigue abierta en D-3.

## Consecuencias

- `internal/ssh` se queda como está y no se le añade una vía alternativa.
- Las mediciones con 10 / 30 / 100 alumnos (`PERFORMANCE.md` §6.1 y §6.3) siguen
  pendientes de la fase 3. Esta decisión no las prejuzga: ninguna de ellas
  cambia el transporte, solo sus topes de concurrencia (D-6).
