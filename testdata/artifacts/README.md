# Corpus común de artefactos · T157

`corpus.json` contiene 72 resultados completos con nombre y decisión de
aceptación explícita. Datos ficticios; no necesita el motor en ejecución,
SSH ni información del profesor. Cada caso es independiente y revisable.

Lo consumen `cmd/heimdall/artifact_corpus_test.go` por el lector compartido
Go y `gui/tests/artifact-corpus.test.ts` por el parser y los lectores de disco
síncrono y asíncrono. Ambos deben coincidir con la decisión publicada, no
solo entre sí: dos lectores que aceptasen la misma corrupción fallarían.

Cobertura: PASS, FAIL, las ocho causas UNEVALUATED, cancelación, excluidos con
checks null o vacíos, copias recuperadas y su excepción de evidencia, reintento
y procedencia, campos ausentes/null, adiciones desconocidas, pesos decimales,
redondeo a mitad, pesos cero, pendientes de 1e-10/1e-100/1e-300, 1e308 válido,
suma desbordada, evidencia recortada después de comparar, corrupción de notas,
identificadores, pesos, terminación, flujos, avisos y presupuesto de evidencia.

El presupuesto omitido conserva compatibilidad con artefactos anteriores;
si aparece debe ser un entero entre 1 y 65536, según el esquema publicado.
Cero explícito y null se rechazan. El cero del modelo Go sigue representando
omisión; no cambia la distribución de evidencia del escritor ni del reintento.

Diferencias reproducidas antes de reparar: Go aceptaba presupuesto 0/null,
fechas de procedencia ausentes/null, avisos incompletos/null, marcador de
recorte null y argumentos null. La GUI aceptaba la suma infinita de pesos de
un artefacto FAIL con nota cero. Todos esos casos son ahora regresiones.

El corpus comprueba paridad en estos casos; no demuestra equivalencia para
cualquier JSON posible. Las notas y vistas siguen calculándose en Go. No se
comparten implementaciones semánticas ni se añaden dependencias; la GUI solo
rechaza incoherencias y presenta los valores publicados. Se conservan las
regresiones A11/A13 y la evidencia de las demás reparaciones en las suites
existentes. Los límites de lectura de T156 tienen sus pruebas separadas.

Comandos: `make check`; en `gui/`, `npm test`, `npm run typecheck` y
`npm run build`. Para ampliar el contrato, añadir aquí un caso completo con
su aceptación esperada y ejecutarlo en ambos entornos.
